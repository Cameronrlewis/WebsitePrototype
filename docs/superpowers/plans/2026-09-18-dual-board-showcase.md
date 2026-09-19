# Dual-Board Cinematic Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage "In motion" block play the Aux Control Board's guided tour, then hand over to the Brick Buck Board's own guided tour, and loop between the two forever.

**Architecture:** The viewer shell (`board-viewer-shell.html`) is already asset-generic: it fetches `/portfolio/assets/viewers/tours/<asset>.tour.json` and falls back to a plain orbit when there is none. So the work is three separable pieces. (1) The shell gains one new outbound message, `tour-cycle`, posted to the embedding page each time its timeline wraps. (2) A new `brick.tour.json` gives the Brick Buck Board its own stops. (3) `BoardShowcase` becomes a container that stacks one iframe per board inside a single framed block, cross-fades between them, plays only the active one, and advances on `tour-cycle`.

No restart message is needed. Each board is paused exactly at its own cycle boundary when it hands over, and the shell already resumes from where it paused, so a board that comes back round naturally resumes at the top of its tour.

**Tech Stack:** Vite 6.3.5, React 18, TypeScript, Tailwind CSS 4, Three.js (vendored plain script), Playwright, Vitest.

**Spec:** No separate spec document exists. The requirement in full, from the user:

> Have this cinematic gif/video go through both current PCBs with 3D model viewers. Currently it's only going over the Control PCB and I want it to go over the Brick Buck Board afterwards and cycle through circling and featuring its specific sections as it spins.

Scope decision recorded here so the executor does not have to guess: **two** boards cycle, Aux Control Board first then Brick Buck Board. The Aux Power Board is not included; it has no tour file and the user named two boards.

## Global Constraints

- Package manager commands always pin the version: `npx pnpm@10.17.1`, never `@latest`. A newer pnpm major has silently dropped the `pnpm.overrides` block, which un-pins Vite 6.3.5 and the `@rollup/wasm-node` alias and breaks the build.
- On macOS npm-cache permission errors: `env npm_config_cache=/private/tmp/npm-cache npx pnpm@10.17.1 install`.
- Gate before every commit: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test`. Gate before the final push: additionally `npx pnpm@10.17.1 e2e` and `npx pnpm@10.17.1 e2e:preview`.
- `pnpm build` does not run `tsc`. Only `pnpm typecheck` catches type errors.
- No em-dashes (—) in user-facing portfolio copy. Tour `label` and `blurb` strings are user-facing copy and are covered by this rule.
- `board-viewer-shell.html` is a plain ES5-style `<script>` with no module loader and no bundler. Use `var`/`let`/`const` and `function` declarations that run directly in the browser. No imports, no optional chaining in that file (match the surrounding style, which uses `&&` guards).
- CI runners have no GPU. They fall back to SwiftShader on two cores, which starves `requestAnimationFrame` and drops in-page `setInterval` samples. Never assert a property across two CDP round trips over a short window, and never measure a camera path by accumulating per-sample deltas. Assert single-sample properties, and identify a tour leg via `__boardTour().from`.
- Existing tour timing, unchanged by this plan: `orbitMs: 12000`, `travelMs: 1500`, `holdMs: 3000`. Full cycle for N stops is `12000 + N * 4500 + 1500` ms.
- `e2e/board-spin.spec.ts` runs `test.describe.configure({ mode: "serial", timeout: 150_000 })`. Keep it serial; `waitForScene` alone can consume 60s of the budget.
- `pages.yml` runs `pnpm e2e:preview` between Build and Upload artifact. A flaky bundle e2e blocks the deploy. The fix for a flake is always to make the test deterministic, never to move the step after the upload.
- Use explicit pathspecs on `git commit`. Never `git add -A`.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `node-local` is a ~230MB gitignored file in the working tree. `git status` takes multiple seconds. Expect git commands to lag.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `public/portfolio/assets/viewers/board-viewer-shell.html` | Modify | Owns the tour timeline. Gains `tourCycleMs()`, the `window.__tourCycleMs` test hook, and posts `{ type: "tour-cycle" }` to the parent when the timeline wraps. |
| `assets-src/board-tours/brick.json` | Create | The Brick Buck Board's tour source: stop ids, copy, and the footprint refs each stop frames. Built by the existing `pnpm build:tour`. |
| `tools/board-tour-geometry.mjs` | Modify | `stopCenter` walks a footprint's real rotated bbox corners rather than assuming its placement origin is its centre. |
| `public/portfolio/assets/viewers/tours/brick.tour.json` | Generate | The Brick Buck Board's tour stops. Same schema as `control.tour.json`. |
| `tests/board-tour-sync.test.ts` | Create | Asserts each checked-in tour file still matches the source it was built from. |
| `src/app/src/app/components/BoardShowcaseFrame.tsx` | Create | One board: the iframe, the ready handshake, and the play/pause postMessage. Driven entirely by props. |
| `src/app/src/app/components/BoardShowcase.tsx` | Modify | The container: one framed block, the IntersectionObserver, mount gating, the caption, which board is active, and advancing on `tour-cycle`. |
| `src/app/src/app/components/Home.tsx` | Modify | Passes the ordered board list to `BoardShowcase`. |
| `e2e/board-spin.spec.ts` | Modify | Pins the new cycle arithmetic, the `tour-cycle` message, the brick stop coordinates, and the two-board handover. Existing selectors updated for the new DOM. |

---

## Task 1: The shell announces the end of a tour cycle

The container needs to know when a board has finished its whole tour. The shell already owns every piece of the timing arithmetic, so it computes and announces this rather than React re-deriving it.

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html`
- Test: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `tourCycleMs(stopCount: number, timing: { orbitMs: number, travelMs: number, holdMs: number }) -> number`, exposed in cinematic mode as `window.__tourCycleMs`.
  - An outbound `postMessage` to `window.parent` of exactly `{ type: "tour-cycle" }`, sent once per completed cycle. Task 3's `BoardShowcaseFrame` listens for this exact string.

- [ ] **Step 1: Write the failing test**

Add this test to `e2e/board-spin.spec.ts`, directly after the existing test named `"tour stops land on the board where the BOM says they do"`. Replace `EXPECTED_X` and `EXPECTED_Z` with the world coordinates the probe reports in Step 6.

Keep it to the probe assertion. Anything that only reads the tour JSON belongs in `tests/board-tour-sync.test.ts`, which already asserts copy, ids, ordering, board bounds and span for every asset: a browser, a WebGL context and a 4MB geometry load are the most expensive test class in this repo, and `pages.yml` runs the e2e suite on the deploy-gating path.

```ts
test("the brick board's tour aims at the part the BOM puts there", async ({ page }) => {
  await page.goto(`${SHELL}?asset=brick&mode=cinematic&probe=brick-converter`);
  await waitForScene(page);

  const probe = await page
    .waitForFunction(() => (window as unknown as { __boardProbe?: () => unknown }).__boardProbe?.(), null, {
      timeout: 30_000,
    })
    .then((handle) => handle.jsonValue() as Promise<{ id: string; world: { x: number; y: number; z: number } }>);

  expect(probe.id).toBe("brick-converter");

  // Signed, not hypot: a y-sign error in the IBOM-to-model conversion mirrors
  // the stop across the board and leaves the distance from the origin intact.
  expect(probe.world.x).toBeCloseTo(EXPECTED_X, 1);
  expect(probe.world.z).toBeCloseTo(EXPECTED_Z, 1);
});
```

- [ ] **Step 6: Read the expected world coordinates and fill them in**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "brick board's tour aims"`

Expected on the first run: FAIL, because `EXPECTED_X` and `EXPECTED_Z` are not defined (a TypeScript error) or, once defined as placeholders, because the received values differ. The failure message prints the received values. Copy the received `probe.world.x` and `probe.world.z` into the test as `EXPECTED_X` and `EXPECTED_Z`, rounded to one decimal place.

This is not circular: Step 4 already established by eye that the stop is on the right part. The test's job from here on is to catch a regression in the conversion, in the geometry file, or in the tour file.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "brick board's tour aims"`

Expected: PASS.

- [ ] **Step 8: Verify the test bites**

Temporarily negate the `y` value of the `brick-converter` stop in `brick.tour.json`, rerun, and confirm the `probe.world.x`/`probe.world.z` assertion fails. Restore the value and rerun to confirm PASS. Do not commit the temporary change.

- [ ] **Step 9: Run the full suite**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 e2e`

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add assets-src/board-tours/brick.json public/portfolio/assets/viewers/tours/brick.tour.json e2e/board-spin.spec.ts
git commit -m "$(cat <<'EOM'
feat: give the Brick Buck Board its own guided tour

Four stops covering the Mornsun brick, the custom 12V to 5V buck, the
per-branch fusing and the battery input. Coordinates come from the board's
own IBOM through the existing build:tour pipeline.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOM
)"
```

---

## Task 3: The showcase cycles through both boards

**Files:**
- Create: `src/app/src/app/components/BoardShowcaseFrame.tsx`
- Modify: `src/app/src/app/components/BoardShowcase.tsx`
- Modify: `src/app/src/app/components/Home.tsx`
- Test: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: the `{ type: "tour-cycle" }` message from Task 1, and `brick.tour.json` from Task 2.
- Produces:
  - `BoardShowcaseFrame({ asset, title, playing, onReady, onCycleEnd })`, where `asset: "power" | "control" | "brick"`, `title: string`, `playing: boolean`, `onReady: () => void`, `onCycleEnd: () => void`.
  - `BoardShowcase({ boards })`, where `boards: Array<{ asset: "power" | "control" | "brick"; title: string }>`.
  - DOM contract the e2e tests depend on: exactly one element with `data-board-showcase` on the page, and one element with `data-board-frame="<asset>"` per board.

### Why no restart message

A board hands over exactly when its own timeline wraps, so it is paused at a cycle boundary. `playOrbit` resumes from `orbitElapsed` rather than resetting it, and `tourPhase` takes `elapsedMs % cycleMs`, so a board that comes back round starts at the top of its tour with no extra message. The existing resume-where-you-left-off behaviour for scrolling away is unchanged.

- [ ] **Step 1: Write the failing test**

Replace the existing test named `"the showcase orbits while on screen and pauses once it scrolls away"` in `e2e/board-spin.spec.ts` in full with the version below. It keeps the original claims and adds the handover. The original used `cinematicFrame(page)`, which finds the first cinematic frame; with two iframes that is ambiguous, so it now selects by asset.

```ts
function cinematicFrameFor(page: Page, asset: string) {
  return page.frames().find((candidate) => candidate.url().includes(`asset=${asset}&mode=cinematic`));
}

test("the showcase orbits while on screen, pauses off screen, and hands over to the next board", async ({ page }) => {
  // Two boards mean two scenes on a software renderer, so this one test gets
  // the whole describe budget rather than being split up.
  test.slow();

  await page.goto("/");

  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-frame='control'] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const control = cinematicFrameFor(page, "control");
  expect(control).toBeTruthy();
  await waitForScene(control!);

  // On screen: the first board plays, with no scrolling involved at all.
  await expect.poll(async () => (await readOrbit(control!))?.playing, { timeout: 30_000 }).toBe(true);

  // The second board is mounted only once the first is ready, so its 4MB of
  // geometry never competes with the first paint.
  await expect(page.locator("[data-board-frame='brick'] iframe")).toBeAttached({ timeout: 30_000 });

  // Scrolled away: paused. The board sits near the top of the page, so the
  // contact section is well past it.
  await page.locator("[data-section='contact']").scrollIntoViewIfNeeded();
  await expect(showcase).not.toBeInViewport();
  await expect.poll(async () => (await readOrbit(control!))?.playing, { timeout: 30_000 }).toBe(false);

  // And it stays parked rather than drifting on.
  const parked = (await readOrbit(control!))!.elapsed;
  await page.waitForTimeout(750);
  expect((await readOrbit(control!))!.elapsed).toBe(parked);

  // Back on screen, and the control tour runs to the end of its cycle: five
  // stops is 36s, so this waits out one whole pass plus slack.
  await showcase.scrollIntoViewIfNeeded();
  const brick = cinematicFrameFor(page, "brick");
  expect(brick).toBeTruthy();
  await waitForScene(brick!);

  // The handover: the brick board takes over and the control board stops.
  // Polled rather than timed, because a software renderer advances the
  // timeline in wall-clock time but delivers frames far slower than 60fps.
  await expect.poll(async () => (await readOrbit(brick!))?.playing, { timeout: 90_000 }).toBe(true);
  expect((await readOrbit(control!))?.playing).toBe(false);

  // The caption follows the board that is actually on screen.
  await expect(showcase).toContainText("Brick Buck Board");
});
```

Also update the existing test named `"reduced motion holds the board on the mid-orbit pose"`: change its

```ts
  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-showcase] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const frame = cinematicFrame(page);
```

to

```ts
  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-frame='control'] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const frame = cinematicFrameFor(page, "control");
```

and delete the now-unused `cinematicFrame` helper near the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "hands over to the next board"`

Expected: FAIL at the first `toBeAttached`, because no element carries `data-board-frame`.

- [ ] **Step 3: Create the per-board frame component**

Create `src/app/src/app/components/BoardShowcaseFrame.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";

interface BoardShowcaseFrameProps {
  asset: "power" | "control" | "brick";
  title: string;
  playing: boolean;
  onReady: () => void;
  onCycleEnd: () => void;
}

/**
 * One board in the showcase: the iframe, the ready handshake, and the
 * play/pause messages. It owns no layout and no visibility logic; the
 * container decides which board is playing and which one is on top.
 */
export function BoardShowcaseFrame({ asset, title, playing, onReady, onCycleEnd }: BoardShowcaseFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // The callbacks come from the container and change identity on every render
  // there. Holding them in refs keeps the message listener from tearing down
  // and re-subscribing, which would drop a tour-cycle landing in the gap.
  const readyRef = useRef(onReady);
  const cycleRef = useRef(onCycleEnd);
  readyRef.current = onReady;
  cycleRef.current = onCycleEnd;

  // Same handshake the modal viewer uses: hold the skeleton until the shell has
  // actually rendered a frame, rather than clearing on the iframe load event.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const type = (event.data as { type?: unknown } | null)?.type;
      if (type === "viewer-ready" || type === "viewer-error") {
        setSceneReady(true);
        readyRef.current();
      } else if (type === "tour-cycle") {
        cycleRef.current();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!sceneReady) {
      return;
    }

    const send = (message: { type: string; progress?: number }) => {
      iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
    };

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const apply = () => {
      if (motionQuery?.matches) {
        // One fixed mid-orbit pose, and the orbit never starts. With the orbit
        // parked there is no tour-cycle either, so the boards do not rotate.
        send({ type: "pause" });
        send({ type: "spin", progress: 0.5 });
        return;
      }

      send({ type: playing ? "play" : "pause" });
    };

    apply();
    motionQuery?.addEventListener("change", apply);
    return () => {
      motionQuery?.removeEventListener("change", apply);
      send({ type: "pause" });
    };
  }, [sceneReady, playing]);

  return (
    <iframe
      ref={iframeRef}
      aria-hidden="true"
      title={`${title} rotating board render`}
      src={`/portfolio/assets/viewers/board-viewer-shell.html?asset=${asset}&mode=cinematic`}
      sandbox="allow-scripts allow-same-origin"
      tabIndex={-1}
      className="pointer-events-none block h-full w-full border-0 bg-[#0c0c14]"
    />
  );
}
```

- [ ] **Step 4: Rewrite the container**

Replace the whole contents of `src/app/src/app/components/BoardShowcase.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

import { BoardShowcaseFrame } from "./BoardShowcaseFrame";
import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface ShowcaseBoard {
  asset: "power" | "control" | "brick";
  title: string;
}

interface BoardShowcaseProps {
  boards: ShowcaseBoard[];
}

/**
 * A non-interactive board that orbits on a loop while it is on screen, the way
 * a looping clip would, handing over to the next board each time one finishes
 * its guided tour. It reuses the modal viewer's iframe shell in
 * `mode=cinematic`, so no geometry, renderer, or dependency is duplicated.
 *
 * Three things are gated rather than left running. The geometry payload runs
 * from roughly 1MB to 4MB depending on the board, so the first iframe is not
 * mounted until the block is near the viewport and the browser is idle, and
 * the rest are not mounted until the first one is live. And the shell only
 * renders frames between `play` and `pause`, so a board that is off screen or
 * waiting its turn costs nothing at all.
 */
export function BoardShowcase({ boards }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [leadReady, setLeadReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);

  // One observer drives both jobs: the first intersection mounts the iframe
  // (and is never undone, since remounting would refetch the geometry), and
  // every later crossing plays or pauses the orbit.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver !== "function") {
      setMounted(true);
      setVisible(true);
      return;
    }

    // The block sits high on the page, so it is usually already on screen at
    // first paint. Mounting straight away would put the geometry fetch in front
    // of the hero, so the mount waits for the browser to go idle. Visibility
    // tracking is not deferred: only the fetch is.
    let idle = 0;
    const mountWhenIdle = () => {
      if (idle) {
        return;
      }

      const request = window.requestIdleCallback;
      idle = typeof request === "function" ? request(() => setMounted(true), { timeout: 2500 }) : window.setTimeout(() => setMounted(true), 600);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        setVisible(isVisible);
        if (isVisible) {
          mountWhenIdle();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (idle) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idle);
        } else {
          window.clearTimeout(idle);
        }
      }
    };
  }, []);

  const advance = useCallback(() => {
    setActive((index) => (index + 1) % Math.max(1, boards.length));
  }, [boards.length]);

  const current = boards[active];
  const showBoard = leadReady && !FORCE_SKELETONS;

  return (
    <div
      ref={wrapperRef}
      data-board-showcase=""
      className="relative h-[22rem] w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] md:h-[28rem]"
    >
      {mounted
        ? boards.map((board, index) => {
            // Only the lead board is mounted up front. The rest wait for it to
            // be live, so the heaviest geometry never competes with the hero.
            if (index > 0 && !leadReady) {
              return null;
            }

            return (
              <div
                key={board.asset}
                data-board-frame={board.asset}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === active && showBoard ? "opacity-100" : "opacity-0"
                }`}
              >
                <BoardShowcaseFrame
                  asset={board.asset}
                  title={board.title}
                  playing={visible && index === active}
                  onReady={index === 0 ? () => setLeadReady(true) : () => {}}
                  onCycleEnd={advance}
                />
              </div>
            );
          })
        : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.94)] via-[rgba(12,12,20,0.6)] to-transparent px-6 pb-5 pt-14">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        <p className="mt-1 font-display text-lg text-white">{current ? current.title : ""}</p>
      </div>
    </div>
  );
}
```

Note the one behavioural subtlety: a board that is not active reports `tour-cycle` only while it is playing, and it is paused whenever it is not active, so exactly one board can advance the index at a time. No debounce is needed.

- [ ] **Step 5: Wire the two boards in Home**

In `src/app/src/app/components/Home.tsx`, replace:

```tsx
      {featuredBoardProjects[0] ? (
        <BoardShowcase
          asset={featuredBoardProjects[0].viewerAsset ?? "power"}
          title={featuredBoardProjects[0].title}
        />
      ) : null}
```

with:

```tsx
      {showcaseBoards.length ? <BoardShowcase boards={showcaseBoards} /> : null}
```

and add this above the component, below the imports, so the list is computed once rather than rebuilt every render:

```tsx
// The two boards that have a guided tour, in the order the showcase plays
// them. Driven by slug rather than by featured order so that featuring
// another board does not silently change what the homepage animates.
const SHOWCASE_SLUGS = ["aux-control-board", "brick-buck-board"];

const showcaseBoards = SHOWCASE_SLUGS.flatMap((slug) => {
  const project = featuredBoardProjects.find((candidate) => candidate.slug === slug);
  return project?.viewerAsset ? [{ asset: project.viewerAsset, title: project.title }] : [];
});
```

`featuredBoardProjects` is already imported in this file. Confirm no other import needs adding.

- [ ] **Step 6: Run typecheck**

Run: `npx pnpm@10.17.1 typecheck`

Expected: exit 0. If `showcaseBoards` is inferred as `{ asset: "power" | "control" | "brick"; title: string }[]`, the `boards` prop type matches. If TypeScript widens `asset` to `string`, add an explicit annotation `const showcaseBoards: Array<{ asset: "power" | "control" | "brick"; title: string }> = ...`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "hands over to the next board"`

Expected: PASS.

- [ ] **Step 8: Verify the handover assertion bites**

Temporarily change `onCycleEnd={advance}` to `onCycleEnd={() => {}}` in `BoardShowcase.tsx`, rerun the same command, and confirm it fails at the `expect.poll(... brick ... ).toBe(true)` with a 90s timeout. Restore `advance` and rerun to confirm PASS. Do not commit the temporary change.

- [ ] **Step 9: Check it by eye**

Run `npx pnpm@10.17.1 dev`, open `http://localhost:5173/`, and watch the "In motion" block for two full minutes. Confirm: the control board orbits and stops at its five parts, then the brick board fades in and does the same for its four, then it comes back round to the control board starting from its orbit rather than mid-tour. Confirm the caption text changes with the board.

- [ ] **Step 10: Run the full gate**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 e2e && npx pnpm@10.17.1 e2e:preview`

Expected: typecheck exits 0, all unit tests pass, and both e2e runs pass. `e2e:preview` is the one that gates the deploy, so it is not optional here.

- [ ] **Step 11: Commit**

```bash
git add src/app/src/app/components/BoardShowcase.tsx src/app/src/app/components/BoardShowcaseFrame.tsx src/app/src/app/components/Home.tsx e2e/board-spin.spec.ts
git commit -m "$(cat <<'EOM'
feat: cycle the homepage showcase through both toured boards

The showcase now stacks one iframe per board in a single framed block and
hands over on the shell's tour-cycle message, so the control board plays its
five stops and the brick board follows with its four. Only the active board
renders frames, and the heavier brick geometry is not fetched until the
first board is live.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOM
)"
```

---

## Self-Review

**Spec coverage.**

| Requirement | Task |
|---|---|
| Go through both current PCBs with 3D model viewers | Task 3 (container cycles a board list), Task 1 (the handover signal) |
| Brick Buck Board comes after the Control PCB | Task 3 Step 5 fixes the order via `SHOWCASE_SLUGS` |
| Circling the Brick board | Already provided by the shell's orbit phase for any asset; Task 2 gives it stops so the orbit is followed by a tour rather than looping bare |
| Featuring the Brick board's specific sections | Task 2 (four stops: brick module, 12V to 5V buck, protection, battery input) |
| Cycle, that is, repeat | Task 3, `(index + 1) % boards.length`, and the shell's own `% cycleMs` wrap |

No gaps.

**Placeholder scan.** The `x`, `y` and `span` zeros in Task 2 Step 3 and the `EXPECTED_X`/`EXPECTED_Z` in Task 2 Step 5 are values that can only be measured, and Steps 2, 4 and 6 are the procedure that measures them. Every other step carries the literal content. No "TBD", no "handle edge cases", no "similar to Task N".

**Type consistency.** `BoardShowcaseFrame`'s prop names (`asset`, `title`, `playing`, `onReady`, `onCycleEnd`) match its call site in `BoardShowcase`. `BoardShowcase`'s single `boards` prop matches its call site in `Home.tsx` and the `ShowcaseBoard` shape matches what `showcaseBoards` builds. `tourCycleMs(stopCount, timing)` has the same argument order in its definition, in `tourPhase`, in `applyTour` and in the test. The message string is `"tour-cycle"` in the shell, the frame component, and the test. The DOM attributes `data-board-showcase` and `data-board-frame` are written in `BoardShowcase.tsx` and read in exactly those spellings by the tests.

**One risk worth naming.** `data-board-showcase` changes from `data-board-showcase={asset}` to a valueless attribute, and the iframe moves from `[data-board-showcase] iframe` to `[data-board-frame='<asset>'] iframe`. Task 3 Step 1 updates both existing tests that use those selectors. Before committing Task 3, grep once for any other consumer: `grep -rn "data-board-showcase" src e2e`.
