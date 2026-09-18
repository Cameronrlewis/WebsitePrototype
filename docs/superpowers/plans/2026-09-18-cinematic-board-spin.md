# Cinematic Board Spin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width showcase block in the Projects section where a PCB does one cinematic orbit, driven by the page's scroll position as the block passes through the viewport.

**Architecture:** No new renderer and no new assets. The existing `public/portfolio/assets/viewers/board-viewer-shell.html` gains a `mode=cinematic` query parameter that suppresses the hint and the mouse/touch controls and accepts a new `spin` postMessage carrying a `0..1` progress value. A new React component `BoardShowcase.tsx` mounts that iframe lazily (IntersectionObserver), then feeds it scroll progress on a rAF-throttled scroll listener. All camera math lives in a pure module `lib/board-spin.ts` so it is unit-testable under the repo's node-environment Vitest setup; the React and iframe wiring is covered by Playwright.

**Tech Stack:** React 18 + TypeScript, the vendored Three.js in `public/portfolio/assets/viewers/vendor/three.min.js`, Tailwind CSS 4 (CSS-first, semantic tokens), Vitest (node env), Playwright.

**Spec:** this document. The requirements below are the spec; there is no separate design doc.

## Spec

1. A single showcase block sits inside the existing `projects` section, below the project grid. It is one board, not one per card.
2. As the block scrolls through the viewport, the board performs exactly one full revolution about its vertical axis, while the camera elevation and distance ease from a high wide three-quarter view at the edges to a low close view at the midpoint.
3. Nothing loads until the block is near the viewport. The geometry payload is between 1MB and 4MB, so it must not be fetched on first paint.
4. The block is non-interactive: no drag, no zoom, no control hint. It is a decorative render, not a second copy of the modal viewer.
5. Under `prefers-reduced-motion: reduce` the board renders one static mid-orbit pose and never moves.
6. The existing modal `BoardViewer` keeps its current interactive behavior unchanged.
7. A loading skeleton covers the block until the viewer reports `viewer-ready`, matching how `BoardViewer` already handles it.

## Global Constraints

- Package manager commands are always pinned: `npx pnpm@10.17.1 ...`, never `@latest`. An unpinned pnpm has dropped the `pnpm.overrides` block that pins vite/rollup-wasm and broken the build.
- Do not add any npm dependency. Three.js is already vendored as a plain script inside the viewer shell; React, `motion`, and lucide-react are already installed.
- No path alias exists. All imports are relative.
- No em-dash characters (`—`) in any user-visible copy.
- The showcase block goes *inside* the existing `<section data-section="projects">`. Do not add a new `[data-section]` element, do not change `Layout.tsx`'s `space-y-16 lg:space-y-24`, and do not change the `lg:pl-12 lg:pr-12` gutters. `CircuitTrace.tsx` measures inter-section gaps and silently drops every IC block if the desktop gap falls under 70px. Section *internal* height may grow freely.
- Styling uses the existing semantic CSS custom properties (`var(--surface-1)`, `var(--outline-soft)`, `var(--text-strong)`, `var(--text-soft)`, `var(--shadow-card)`). There is no `tailwind.config.*`; do not create one, and do not create a `postcss.config.*`.
- Verification gate, in order: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build`, then `npx pnpm@10.17.1 e2e`.
- Vitest runs with `environment: "node"` and `include: ["tests/**/*.test.ts"]`. Unit tests cannot render React and cannot import `.tsx`. Pure logic goes in `src/app/src/app/lib/*.ts` and is tested there; component behavior is tested in `e2e/`.

---

### Task 1: Spin camera math

Pure functions mapping a viewport rectangle to a scroll progress value, and that progress to a camera pose. Nothing here imports React or Three.

**Files:**
- Create: `src/app/src/app/lib/board-spin.ts`
- Test: `tests/board-spin.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface SpinPose { theta: number; phi: number; radiusScale: number }`
  - `export const SPIN_START_THETA: number` (value `-0.5`, matching the shell's existing `defaults.theta`)
  - `export function scrollProgress(top: number, height: number, viewportHeight: number): number` returning `0..1`
  - `export function spinPose(progress: number): SpinPose`
  - Task 2 reimplements `spinPose` inline in the plain-JS viewer shell (the shell loads no modules); Task 3 imports both functions.

- [ ] **Step 1: Write the failing test**

Create `tests/board-spin.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SPIN_START_THETA, scrollProgress, spinPose } from "../src/app/src/app/lib/board-spin";

describe("scrollProgress", () => {
  it("is 0 when the block's top sits at the bottom edge of the viewport", () => {
    expect(scrollProgress(800, 400, 800)).toBe(0);
  });

  it("is 1 when the block's bottom sits at the top edge of the viewport", () => {
    expect(scrollProgress(-400, 400, 800)).toBe(1);
  });

  it("is 0.5 when the block is centred in the viewport", () => {
    expect(scrollProgress(200, 400, 800)).toBeCloseTo(0.5, 5);
  });

  it("clamps outside the travel window instead of running past one revolution", () => {
    expect(scrollProgress(5000, 400, 800)).toBe(0);
    expect(scrollProgress(-5000, 400, 800)).toBe(1);
  });

  it("returns the midpoint rather than dividing by zero on a zero-height viewport", () => {
    expect(scrollProgress(0, 0, 0)).toBe(0.5);
  });
});

describe("spinPose", () => {
  it("starts at the shell's default heading", () => {
    expect(spinPose(0).theta).toBeCloseTo(SPIN_START_THETA, 5);
  });

  it("completes exactly one revolution across the travel window", () => {
    expect(spinPose(1).theta - spinPose(0).theta).toBeCloseTo(Math.PI * 2, 5);
  });

  it("dives low and close at the midpoint and sits high and wide at both edges", () => {
    const start = spinPose(0);
    const middle = spinPose(0.5);
    const end = spinPose(1);

    expect(middle.phi).toBeLessThan(start.phi);
    expect(middle.radiusScale).toBeLessThan(start.radiusScale);
    expect(end.phi).toBeCloseTo(start.phi, 5);
    expect(end.radiusScale).toBeCloseTo(start.radiusScale, 5);
  });

  it("keeps phi inside the shell's own polar clamp so the camera never flips", () => {
    for (let step = 0; step <= 20; step += 1) {
      const pose = spinPose(step / 20);
      expect(pose.phi).toBeGreaterThan(0.04);
      expect(pose.phi).toBeLessThan(Math.PI - 0.04);
    }
  });

  it("clamps out-of-range progress to the ends of the travel window", () => {
    expect(spinPose(-3).theta).toBeCloseTo(spinPose(0).theta, 5);
    expect(spinPose(3).theta).toBeCloseTo(spinPose(1).theta, 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx pnpm@10.17.1 vitest run tests/board-spin.test.ts`
Expected: FAIL, `Failed to resolve import "../src/app/src/app/lib/board-spin"`.

- [ ] **Step 3: Write the implementation**

Create `src/app/src/app/lib/board-spin.ts`:

```ts
/**
 * Camera path for the non-interactive board showcase. The viewer shell owns
 * the same curve in plain JS (it loads no modules); keep the two in step.
 */

export interface SpinPose {
  /** Azimuth in radians, matching the shell's `state.theta`. */
  theta: number;
  /** Polar angle in radians, matching the shell's `state.phi`. */
  phi: number;
  /** Multiplier on the board's max dimension, matching `state.r / maxDimension`. */
  radiusScale: number;
}

/** The shell's own `defaults.theta`, so progress 0 matches a freshly opened viewer. */
export const SPIN_START_THETA = -0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Maps a block's viewport rectangle to 0..1: 0 when its top edge touches the
 * bottom of the viewport, 1 when its bottom edge touches the top.
 */
export function scrollProgress(top: number, height: number, viewportHeight: number): number {
  const travel = viewportHeight + height;
  if (travel <= 0) {
    return 0.5;
  }

  return clamp01((viewportHeight - top) / travel);
}

/** One full revolution, easing low and close through the midpoint. */
export function spinPose(progress: number): SpinPose {
  const t = clamp01(progress);
  // sin(pi * t) is 0 at both ends and 1 at the midpoint, so the camera drops
  // and closes in as the block crosses the middle of the screen.
  const dive = Math.sin(Math.PI * t);

  return {
    theta: SPIN_START_THETA + t * Math.PI * 2,
    phi: 1.25 - dive * 0.7,
    radiusScale: 1.7 - dive * 0.45,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx pnpm@10.17.1 vitest run tests/board-spin.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/lib/board-spin.ts tests/board-spin.test.ts
git commit -m "feat: add cinematic board spin camera path"
```

---

### Task 2: Cinematic mode in the viewer shell

The shell learns a `mode=cinematic` parameter and a `spin` message. Interactive behavior is untouched when the parameter is absent.

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html`
- Test: `e2e/board-spin.spec.ts` (created here, extended in Task 4)

**Interfaces:**
- Consumes: the curve defined in Task 1 (`spinPose`), reimplemented inline because the shell is a plain `<script>` with no module loader.
- Produces:
  - Query parameter `mode=cinematic` on `/portfolio/assets/viewers/board-viewer-shell.html`.
  - Accepted message `{ type: "spin", progress: number }` from the same origin.
  - `window.__boardViewerState` on the iframe's window: a live reference to the camera state object `{ theta, phi, r, tx, ty, tz }`, so Playwright can assert the camera actually moved. Same-origin, so `frame.evaluate` can read it.

- [ ] **Step 1: Write the failing test**

Create `e2e/board-spin.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const SHELL = "/portfolio/assets/viewers/board-viewer-shell.html";

// The shell renders into a canvas, so a screenshot cannot tell us the camera
// moved. It exposes its live camera state instead.
async function readCameraState(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number; phi: number; r: number } }).__boardViewerState);
}

test("cinematic mode hides the control hint and ignores drag", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power&mode=cinematic`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  await expect(page.locator("#hint")).toBeHidden();

  const before = await readCameraState(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 320, { steps: 10 });
  await page.mouse.up();
  const after = await readCameraState(page);

  expect(after?.theta).toBeCloseTo(before!.theta, 6);
  expect(after?.phi).toBeCloseTo(before!.phi, 6);
});

test("a spin message drives the camera through one revolution", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power&mode=cinematic`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  const send = (progress: number) =>
    page.evaluate((value) => window.postMessage({ type: "spin", progress: value }, window.location.origin), progress);

  await send(0);
  const start = await readCameraState(page);
  await send(0.5);
  const middle = await readCameraState(page);
  await send(1);
  const end = await readCameraState(page);

  expect(start?.theta).toBeCloseTo(-0.5, 5);
  expect(end!.theta - start!.theta).toBeCloseTo(Math.PI * 2, 4);
  // Low and close at the midpoint.
  expect(middle!.phi).toBeLessThan(start!.phi);
  expect(middle!.r).toBeLessThan(start!.r);
});

test("the interactive viewer still accepts drag when the mode parameter is absent", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  await expect(page.locator("#hint")).toBeVisible();

  const before = await readCameraState(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 200, { steps: 10 });
  await page.mouse.up();
  const after = await readCameraState(page);

  expect(after?.theta).not.toBeCloseTo(before!.theta, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx pnpm@10.17.1 e2e board-spin.spec.ts`
Expected: FAIL. The first two tests time out on the `__boardViewerState` poll (the shell never exposes it); the third also fails for the same reason.

- [ ] **Step 3: Read the mode parameter**

In `public/portfolio/assets/viewers/board-viewer-shell.html`, directly below the existing `asset` line:

```js
        const asset = assetParam === "control" || assetParam === "brick" ? assetParam : "power";
        const cinematic = params.get("mode") === "cinematic";
```

- [ ] **Step 4: Add the spin curve and apply function**

Add these two functions next to the existing `topView` function:

```js
        /**
         * Mirror of src/app/src/app/lib/board-spin.ts. This file is a plain
         * script with no module loader, so the curve is duplicated on purpose;
         * change both together.
         */
        function spinPose(progress) {
          const t = Math.min(1, Math.max(0, progress));
          const dive = Math.sin(Math.PI * t);
          return {
            theta: -0.5 + t * Math.PI * 2,
            phi: 1.25 - dive * 0.7,
            radiusScale: 1.7 - dive * 0.45,
          };
        }

        function applySpin(progress) {
          const pose = spinPose(progress);
          state.theta = pose.theta;
          state.phi = pose.phi;
          state.r = maxDimension * pose.radiusScale;
          state.tx = 0;
          state.ty = 0;
          state.tz = 0;
          updateCamera();
        }
```

- [ ] **Step 5: Skip the controls and the hint in cinematic mode**

In `buildScene`, replace the single line `bindControls(renderer.domElement);` with:

```js
          if (cinematic) {
            hint.style.display = "none";
            renderer.domElement.style.cursor = "default";
            applySpin(0);
          } else {
            bindControls(renderer.domElement);
          }
```

Then, immediately after the existing `state = Object.assign({}, defaults);` line, expose the live state object for tests:

```js
          window.__boardViewerState = state;
```

- [ ] **Step 6: Accept the spin message**

In the `window.addEventListener("message", ...)` handler, add a branch alongside the existing `reset` / `top` / `wireframe` branches:

```js
          } else if (event.data.type === "spin") {
            if (cinematic && typeof event.data.progress === "number" && Number.isFinite(event.data.progress)) {
              applySpin(event.data.progress);
            }
          }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx pnpm@10.17.1 e2e board-spin.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Run the existing viewer e2e to confirm nothing regressed**

Run: `npx pnpm@10.17.1 e2e project-modal.spec.ts modal-transitions.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html e2e/board-spin.spec.ts
git commit -m "feat: add cinematic scroll-driven mode to the board viewer shell"
```

---

### Task 3: The showcase component

A lazily mounted, non-interactive board that receives scroll progress. This task ends with the block visible on the page; Task 4 pins its behavior down with e2e tests.

**Files:**
- Create: `src/app/src/app/components/BoardShowcase.tsx`
- Modify: `src/app/src/app/components/Projects.tsx`

**Interfaces:**
- Consumes: `scrollProgress` and `spinPose` from `../lib/board-spin` (Task 1); the `mode=cinematic` parameter and `spin` message from the shell (Task 2); `BoardViewerSkeleton` and `FORCE_SKELETONS` from `./Skeletons`.
- Produces: `export function BoardShowcase(props: { asset: "power" | "control" | "brick"; title: string; caption: string }): JSX.Element`, and a `data-board-showcase` attribute on its wrapper element for Task 4 to target.

- [ ] **Step 1: Write the component**

Create `src/app/src/app/components/BoardShowcase.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";

import { scrollProgress } from "../lib/board-spin";
import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface BoardShowcaseProps {
  asset: "power" | "control" | "brick";
  title: string;
  caption: string;
}

// The block only has to travel far enough for the orbit to read as deliberate.
// Progress is measured against the wrapper, so this height is the whole curve.
const BLOCK_HEIGHT = "h-[26rem] md:h-[34rem]";

/**
 * A non-interactive board that turns once as it crosses the viewport. It reuses
 * the modal viewer's iframe shell in `mode=cinematic`, so no geometry, renderer,
 * or dependency is duplicated. The geometry payload is between 1MB and 4MB, so
 * the iframe is not mounted at all until the block is close to the viewport.
 */
export function BoardShowcase({ asset, title, caption }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  // Mount once, near the viewport, and never unmount: remounting would refetch
  // the geometry every time the block scrolls away.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver !== "function") {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Same handshake the modal viewer uses: hold the skeleton until the shell has
  // actually rendered a frame, rather than clearing on the iframe load event.
  useEffect(() => {
    if (!mounted) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const type = (event.data as { type?: unknown } | null)?.type;
      if (type === "viewer-ready" || type === "viewer-error") {
        setSceneReady(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted]);

  useEffect(() => {
    if (!sceneReady) {
      return;
    }

    const send = (progress: number) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "spin", progress }, window.location.origin);
    };

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      // One fixed mid-orbit pose, and no listener at all.
      send(0.5);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      send(scrollProgress(rect.top, rect.height, window.innerHeight));
    };

    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    // The portfolio scrolls inside <main>, not the window, so listen in the
    // capture phase to catch the scroll wherever it happens.
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [sceneReady]);

  const showBoard = sceneReady && !FORCE_SKELETONS;

  return (
    <div
      ref={wrapperRef}
      data-board-showcase={asset}
      className={`relative w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] ${BLOCK_HEIGHT}`}
    >
      {mounted ? (
        <iframe
          ref={iframeRef}
          title={`${title} rotating board render`}
          src={`/portfolio/assets/viewers/board-viewer-shell.html?asset=${asset}&mode=cinematic`}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          className={`pointer-events-none block h-full w-full border-0 bg-[#0c0c14] transition-opacity duration-700 ${showBoard ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.92)] to-transparent px-6 pb-6 pt-16">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        <p className="mt-1 font-display text-lg text-white">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-white/60">{caption}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the Projects section**

In `src/app/src/app/components/Projects.tsx`, add the import beside the existing component imports:

```tsx
import { BoardShowcase } from "./BoardShowcase";
```

Then, inside the outer `<div className="space-y-7">`, immediately after the closing `</div>` of the `grid gap-5 md:grid-cols-2 xl:grid-cols-3` block and before that outer div closes, add:

```tsx
        {/* Power board is the smallest geometry payload of the three; swap the
            asset here if another board should carry the showcase. */}
        <BoardShowcase
          asset="power"
          title="Aux Power Board"
          caption="The same geometry the interactive viewer loads, on a fixed camera path. Open any board card for the full viewer."
        />
```

- [ ] **Step 3: Verify it compiles and the suite still passes**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test`
Expected: PASS, no type errors.

- [ ] **Step 4: Look at it**

Run: `npx pnpm@10.17.1 dev`
Open `http://localhost:5173/#/projects` and scroll the showcase block through the viewport. Confirm: the skeleton appears first, the board fades in, it turns roughly one full revolution over the scroll, it dives lower and closer at the midpoint, and dragging on it does nothing.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/components/BoardShowcase.tsx src/app/src/app/components/Projects.tsx
git commit -m "feat: add scroll-driven board showcase to the projects section"
```

---

### Task 4: End-to-end coverage for the showcase

The component's two load-bearing behaviors are invisible to a screenshot: nothing fetches until the block nears the viewport, and the camera tracks scroll. Both regress silently.

**Files:**
- Modify: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: `data-board-showcase="power"` on the wrapper (Task 3), `window.__boardViewerState` inside the iframe (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

Append to `e2e/board-spin.spec.ts`:

```ts
const GEOMETRY = "**/portfolio/assets/viewers/geometry/*.pcbgeo";

test("the showcase does not fetch geometry until it is near the viewport", async ({ page }) => {
  let requested = 0;
  await page.route(GEOMETRY, async (route) => {
    requested += 1;
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  // Give the page room to settle before asserting the negative.
  await page.waitForTimeout(1500);
  expect(requested).toBe(0);

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect.poll(() => requested, { timeout: 30_000 }).toBe(1);
});

test("scrolling the showcase past the viewport turns the board", async ({ page }) => {
  await page.goto("/");

  const showcase = page.locator("[data-board-showcase='power']");
  await showcase.scrollIntoViewIfNeeded();

  const viewer = page.frameLocator("[data-board-showcase] iframe");
  await expect(viewer.locator("#viewer canvas")).toBeAttached({ timeout: 30_000 });

  const frame = page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
  expect(frame).toBeTruthy();

  const readTheta = async () =>
    (await frame!.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number } }).__boardViewerState?.theta)) ?? Number.NaN;

  await expect.poll(async () => Number.isFinite(await readTheta()), { timeout: 30_000 }).toBe(true);
  const before = await readTheta();

  await page.mouse.wheel(0, 900);
  await expect.poll(async () => Math.abs((await readTheta()) - before), { timeout: 10_000 }).toBeGreaterThan(0.2);
});

test("reduced motion holds the board on a single pose", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  const viewer = page.frameLocator("[data-board-showcase] iframe");
  await expect(viewer.locator("#viewer canvas")).toBeAttached({ timeout: 30_000 });

  const frame = page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
  const readTheta = async () =>
    (await frame!.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number } }).__boardViewerState?.theta)) ?? Number.NaN;

  await expect.poll(async () => Number.isFinite(await readTheta()), { timeout: 30_000 }).toBe(true);
  const before = await readTheta();

  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(800);
  expect(await readTheta()).toBeCloseTo(before, 5);

  await context.close();
});
```

- [ ] **Step 2: Run the tests**

Run: `npx pnpm@10.17.1 e2e board-spin.spec.ts`
Expected: PASS, 6 tests total in the file.

If the scroll test fails because the wheel event did not move the block far enough, increase the wheel delta rather than lowering the `0.2` radian threshold: a threshold near zero would pass on a broken build.

If the reduced-motion test fails because the showcase never reaches `viewer-ready`, check that the `prefers-reduced-motion` branch in Task 3 still sends its single `send(0.5)` call; the skeleton clears on `viewer-ready`, not on the spin message, so the two are independent.

- [ ] **Step 3: Run the whole gate**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build && npx pnpm@10.17.1 e2e`
Expected: all PASS. The full e2e run matters here because `pages.yml` gates the deploy on the preview e2e run; a flake in this new spec blocks a release.

- [ ] **Step 4: Verify the trace survived the taller section**

Run: `npx pnpm@10.17.1 e2e circuit-trace.spec.ts`
Expected: PASS. The showcase grows the projects section's internal height, which is allowed, but this is the test that catches it if the block was accidentally placed outside the section or as a sibling `[data-section]`.

- [ ] **Step 5: Commit**

```bash
git add e2e/board-spin.spec.ts
git commit -m "test: cover the scroll-driven board showcase end to end"
```

---

## Notes on what was deliberately left out

- **No second board.** One showcase, one geometry fetch, one WebGL context. Adding a spin to every `viewer3d` card would pull up to 6.7MB of geometry and three contexts on mobile. Add a second `BoardShowcase` only if the first one measurably earns it.
- **No pre-rendered video pipeline.** A headless render plus ffmpeg would be cheaper at runtime but adds a build tool and checked-in binaries. Revisit only if the live render measures badly on real mobile hardware.
- **The curve is duplicated** between `lib/board-spin.ts` and the shell, on purpose: the shell is a plain script with no module loader, and wiring a bundler into it costs more than the six duplicated lines. Both copies carry a comment pointing at the other.
