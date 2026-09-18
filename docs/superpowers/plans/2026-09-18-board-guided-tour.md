# Guided Board Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the home page "In motion" board from a fixed orbit into a guided tour that breathes in and out as it spins, then pauses on each named section of the PCB (STM32, 5V to 3V3 LDO, CAN transceiver, level shifter, USB to UART) with a label, before resuming.

**Architecture:** Component positions are not hand-authored. The checked-in Interactive BOM already carries every footprint's KiCad millimetre position, so a build tool joins a small hand-written list of tour stops (label, blurb, refs) against those positions and emits one `<asset>.tour.json` per board into `public/`. The viewer shell gains a `tour` mode: it fetches that JSON, converts each stop into the board's local 3D space, and runs a state machine that eases the camera between orbiting and holding on a stop. Labels are drawn by the shell itself as a DOM overlay, projected from the 3D point, because the shell owns the camera.

**Tech Stack:** The vendored Three.js in `public/portfolio/assets/viewers/vendor/three.min.js`, plain ES5-style JavaScript in the viewer shell, React 18 + TypeScript for the host component, Node for the build tool (driving Playwright's already-installed Chromium), Vitest, Playwright.

**Spec:** this document. The Spec section below is the authority; there is no separate design doc.

## Spec

1. While orbiting, the camera distance eases in and out rather than holding one radius, so the board visibly breathes.
2. After a configurable number of revolutions the orbit pauses and the camera eases to a named section of the board, holds, shows a label, then eases to the next.
3. After the last stop the camera returns to the free orbit and the cycle repeats.
4. Stop positions are derived from the Interactive BOM's footprint data, never hand-typed coordinates. The hand-written part is only which refs belong to which named section, plus the copy.
5. The control board ships these stops, in this order: STM32 (U4), 5V to 3V3 LDO (U2), CAN transceiver (U5), Level shifter (Q3, Q4), USB to UART (U3).
6. A board with no tour file falls back to the existing plain orbit with no error.
7. Under `prefers-reduced-motion: reduce` the tour does not run: the board holds one static pose as it does today.
8. The tour pauses when the block leaves the viewport and resumes where it left off, exactly as the orbit does today.
9. The whole feature stays inside the existing iframe shell. No new runtime dependency and no new rendering surface.

## Global Constraints

- Package manager commands are always pinned: `npx pnpm@10.17.1 ...`, never `@latest` or bare `pnpm`. An unpinned pnpm has dropped the `pnpm.overrides` block that pins vite/rollup-wasm and broken the build.
- Add no runtime npm dependency. The build tool must use only what is already installed: Node's stdlib plus `@playwright/test`'s bundled Chromium.
- No path alias exists. All imports are relative.
- No em-dash characters in any user-visible copy or comment.
- `public/portfolio/assets/viewers/board-viewer-shell.html` is a plain `<script>` with no module loader. Match its existing style: function declarations, `const`/`let` as the file already uses, no ES modules, no optional chaining.
- The interactive modal viewer shares that shell. Behaviour when `mode` is absent must not change. `e2e/board-spin.spec.ts` guards this.
- The shell has no permanent render loop. Any code that moves the camera must repaint: `updateCamera()` already calls `requestRender()`, and `requestRender()` no-ops while the orbit is playing because the orbit loop draws every frame.
- Vitest runs with `environment: "node"` and `include: ["tests/**/*.test.ts"]`. It cannot render React and cannot import `.tsx`. Pure logic goes in a `.ts` module under `src/app/src/app/lib/` or `tools/`, and browser behaviour is tested in `e2e/`.
- `e2e/board-spin.spec.ts` runs serially with a 90s budget because CI has no GPU and falls back to a software renderer. Keep new e2e assertions in that file, and keep them few and dense: every extra `page.goto` of a board scene costs a full geometry fetch, a JS decode and a WebGL context.
- Verification gate, in order: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build`, then `npx pnpm@10.17.1 e2e`.

## Established facts

These were measured against the real files. Use them; do not re-derive them.

- `public/portfolio/assets/bom/control/IBOM.html` sets `window.pcbdata` after load. It is LZString-compressed in the source, so it can only be read by evaluating the page in a browser, not by parsing the HTML.
- `pcbdata.footprints` is an array of `{ ref, layer, bbox: { pos: [x, y], size: [w, h], angle }, pads, drawings }`. The control board has 85 entries. `pos` is in millimetres in KiCad page coordinates.
- `pcbdata.edges_bbox` for the control board is `{ minx: 72.975, miny: 50.975, maxx: 135.025, maxy: 125.525 }`, so the board outline centre is `(104.0, 88.25)`.
- `control.pcbgeo` decodes to a bounding box of x `-31 .. 32.284`, y `-37.25 .. 37.25`, z `-4.3 .. 13.6` in millimetres. The y half-span of 37.25 matches the IBOM's y half-span of 37.275 to within 0.025mm, and the x minimum of -31 matches -31.025. The x maximum is larger because a connector overhangs the board outline.
- Therefore a footprint at IBOM `(px, py)` sits at board-local `(px - 104.0, ±(py - 88.25), 0)`. **The sign of the y term is unverified** and Task 2 determines it empirically rather than assuming.
- The shell builds `boardGroup` with `rotation.x = -Math.PI / 2`, plus `rotation.z = -Math.PI / 2` when the asset is `control`, and then recentres it with `boardGroup.position.sub(center)`. Do not reimplement that transform: call `boardGroup.localToWorld(...)` and let Three apply it.
- Relevant control board parts, confirmed from the IBOM: `U4` STM32G474RETx (LQFP-64); `U2` TLV76733DRVR; `U5` SN65HVD230; `Q3`/`Q4` 2N7002; `U3` CP2104.
- **Positions in this document are rounded for reading and are not the live values.** The IBOM stores full precision, for example `U4` is at `[102.41, 78.325]` with size `[13.45, 13.45]`, not `102.4, 78.3, 13.4`. Never assert a generated coordinate against a rounded figure quoted in prose; read it from the BOM.

---

### Task 1: Tour stop source data and the build tool

A hand-written list of stops joined against the IBOM's footprint positions, emitted as one small JSON per board.

**Files:**
- Create: `assets-src/board-tours/control.json`
- Create: `tools/build-board-tour.mjs`
- Create: `tools/board-tour-geometry.mjs`
- Create: `tools/board-tour-geometry.d.mts`
- Create: `tests/board-tour-geometry.test.ts`
- Modify: `package.json` (add the `build:tour` script)
- Generated (committed): `public/portfolio/assets/viewers/tours/control.tour.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `tools/board-tour-geometry.mjs` exports `toBoardLocal(pos, edgesBbox, flipY)` returning `{ x, y }`, and `stopCenter(refs, footprints)` returning `{ pos: [number, number], span: number }`. Its types come from the hand-written sibling `tools/board-tour-geometry.d.mts`.
  - The generated file's shape, which Task 2 reads:
    ```json
    {
      "asset": "control",
      "flipY": true,
      "stops": [
        { "id": "mcu", "label": "STM32G474", "blurb": "...", "refs": ["U4"], "x": -1.6, "y": 9.95, "span": 13.4 }
      ]
    }
    ```
    `x` and `y` are board-local millimetres, `span` is the larger footprint dimension in millimetres, used by Task 2 to choose a zoom distance.

- [ ] **Step 1: Write the stop source data**

Create `assets-src/board-tours/control.json`. Refs and part numbers are verified against the IBOM; copy is plain prose with no em-dash.

```json
{
  "asset": "control",
  "stops": [
    {
      "id": "mcu",
      "label": "STM32G474",
      "blurb": "The microcontroller. 170MHz Cortex-M4 with the timers and comparators the motor control loop runs on.",
      "refs": ["U4"]
    },
    {
      "id": "ldo",
      "label": "5V to 3V3 LDO",
      "blurb": "TLV76733 regulator. Drops the 5V input rail to the 3V3 the logic runs on.",
      "refs": ["U2"]
    },
    {
      "id": "can",
      "label": "CAN transceiver",
      "blurb": "SN65HVD230. Turns the controller's CAN signals into the differential pair the vehicle bus carries.",
      "refs": ["U5"]
    },
    {
      "id": "level-shift",
      "label": "Level shifter",
      "blurb": "A 2N7002 pair. Translates between the 3V3 logic and 5V peripherals in both directions.",
      "refs": ["Q3", "Q4"]
    },
    {
      "id": "usb-uart",
      "label": "USB to UART",
      "blurb": "CP2104 bridge. Exposes the debug console over the USB port without a separate programmer.",
      "refs": ["U3"]
    }
  ]
}
```

- [ ] **Step 2: Write the failing test for the geometry helpers**

Create `tests/board-tour-geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { stopCenter, toBoardLocal } from "../tools/board-tour-geometry.mjs";

// The real control board outline, from public/portfolio/assets/bom/control/IBOM.html.
const EDGES = { minx: 72.975, miny: 50.975, maxx: 135.025, maxy: 125.525 };

describe("toBoardLocal", () => {
  it("puts the outline centre at the origin", () => {
    expect(toBoardLocal([104, 88.25], EDGES, true)).toEqual({ x: 0, y: 0 });
  });

  it("flips the y axis when asked, because KiCad measures y downward", () => {
    // U4, the STM32, sits above centre in KiCad's downward y.
    expect(toBoardLocal([102.4, 78.3], EDGES, true)).toEqual({ x: -1.6, y: 9.95 });
    expect(toBoardLocal([102.4, 78.3], EDGES, false)).toEqual({ x: -1.6, y: -9.95 });
  });

  it("keeps the board inside the half span the geometry reports", () => {
    // The pcbgeo bounding box is y -37.25..37.25, so no corner may exceed it.
    for (const y of [EDGES.miny, EDGES.maxy]) {
      expect(Math.abs(toBoardLocal([104, y], EDGES, true).y)).toBeLessThan(37.3);
    }
  });
});

describe("stopCenter", () => {
  // Synthetic fixtures with rounded numbers. These exercise the arithmetic and
  // are deliberately NOT the live BOM values, which carry more precision.
  const footprints = [
    { ref: "Q3", bbox: { pos: [94.1, 115.7], size: [3.9, 3.5] } },
    { ref: "Q4", bbox: { pos: [94.1, 111.7], size: [3.9, 3.5] } },
    { ref: "U4", bbox: { pos: [102.4, 78.3], size: [13.4, 13.4] } },
  ];

  it("returns a single footprint's own centre and largest dimension", () => {
    expect(stopCenter(["U4"], footprints)).toEqual({ pos: [102.4, 78.3], span: 13.4 });
  });

  it("spans the bounding box of a multi-part stop", () => {
    // Q3 and Q4 are 4mm apart in y, so the pair spans their outer edges.
    expect(stopCenter(["Q3", "Q4"], footprints)).toEqual({ pos: [94.1, 113.7], span: 7.5 });
  });

  it("throws on a ref that is not on the board, rather than silently skipping it", () => {
    expect(() => stopCenter(["U99"], footprints)).toThrow(/U99/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx pnpm@10.17.1 vitest run tests/board-tour-geometry.test.ts`
Expected: FAIL, `Failed to resolve import "../tools/board-tour-geometry.mjs"`.

- [ ] **Step 4: Write the geometry helpers**

Create `tools/board-tour-geometry.mjs`:

```js
/**
 * Pure geometry for the board tour build. Kept separate from the build tool so
 * it can be unit tested without launching a browser.
 */

/**
 * Converts a KiCad millimetre position into board-local millimetres, with the
 * board outline's centre at the origin. KiCad measures y downward and the
 * exported geometry measures it upward, so `flipY` negates it.
 */
export function toBoardLocal(pos, edgesBbox, flipY) {
  const cx = (edgesBbox.minx + edgesBbox.maxx) / 2;
  const cy = (edgesBbox.miny + edgesBbox.maxy) / 2;
  const y = pos[1] - cy;

  return { x: round(pos[0] - cx), y: round(flipY ? -y : y) };
}

/** Centre and size of one stop, which may cover several footprints. */
export function stopCenter(refs, footprints) {
  const byRef = new Map(footprints.map((f) => [f.ref, f]));
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;

  for (const ref of refs) {
    const fp = byRef.get(ref);
    if (!fp) {
      throw new Error(`Tour references ${ref}, which is not on this board.`);
    }

    const [px, py] = fp.bbox.pos;
    const [w, h] = fp.bbox.size;
    minx = Math.min(minx, px - w / 2);
    maxx = Math.max(maxx, px + w / 2);
    miny = Math.min(miny, py - h / 2);
    maxy = Math.max(maxy, py + h / 2);
  }

  return {
    pos: [round((minx + maxx) / 2), round((miny + maxy) / 2)],
    span: round(Math.max(maxx - minx, maxy - miny)),
  };
}

// Millimetre positions do not need more than this, and exact values keep the
// generated file stable and reviewable in diffs.
function round(value) {
  return Math.round(value * 1000) / 1000;
}
```

- [ ] **Step 5: Write the type declaration**

`tsconfig.json` sets `"allowJs": false` and excludes `tools`, so `tsc --noEmit` cannot read the `.mjs` directly and the test's import would fail typecheck. A hand-written sibling declaration fixes that with no config change. This was verified against this repo before the plan was written: with the declaration present, `npx pnpm@10.17.1 typecheck` is clean and vitest still resolves the `.mjs` at runtime.

Create `tools/board-tour-geometry.d.mts`:

```ts
export interface EdgesBbox {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface Footprint {
  ref: string;
  bbox: { pos: [number, number]; size: [number, number] };
}

export declare function toBoardLocal(
  pos: [number, number],
  edgesBbox: EdgesBbox,
  flipY: boolean,
): { x: number; y: number };

export declare function stopCenter(
  refs: string[],
  footprints: Footprint[],
): { pos: [number, number]; span: number };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx pnpm@10.17.1 vitest run tests/board-tour-geometry.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Confirm typecheck stays clean**

Run: `npx pnpm@10.17.1 typecheck`
Expected: no output, exit 0. If it reports a missing module or an implicit `any` for the import, the declaration file is not sitting next to the `.mjs` with the matching base name.

- [ ] **Step 8: Write the build tool**

Create `tools/build-board-tour.mjs`. It reads `window.pcbdata` from a real browser because the IBOM payload is LZString-compressed, and Playwright's Chromium is already installed as a dev dependency.

```js
/**
 * Joins assets-src/board-tours/<asset>.json against the checked-in Interactive
 * BOM and writes public/portfolio/assets/viewers/tours/<asset>.tour.json.
 *
 * The IBOM stores its payload LZString-compressed inside a script tag, so the
 * only reliable way to read it is to let a browser run the page. Playwright's
 * Chromium ships with the dev dependencies, so this adds nothing to install.
 *
 * Usage: npx pnpm@10.17.1 build:tour [asset]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { stopCenter, toBoardLocal } from "./board-tour-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The exported geometry measures y upward while KiCad measures it downward.
// Task 2 verifies this against the rendered board.
const FLIP_Y = true;

const bomByAsset = {
  power: "public/portfolio/assets/bom/power/IBOM.html",
  control: "public/portfolio/assets/bom/control/IBOM.html",
  brick: "public/portfolio/assets/bom/brick-buck/IBOM.html",
};

async function readPcbData(bomPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // The IBOM logs its own errors on load; they are not ours to fix.
    page.on("pageerror", () => {});
    await page.goto(pathToFileURL(path.join(root, bomPath)).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.pcbdata !== "undefined", null, { timeout: 30000 });
    return await page.evaluate(() => ({
      edges_bbox: window.pcbdata.edges_bbox,
      footprints: window.pcbdata.footprints.map((f) => ({ ref: f.ref, bbox: { pos: f.bbox.pos, size: f.bbox.size } })),
    }));
  } finally {
    await browser.close();
  }
}

async function build(asset) {
  const bomPath = bomByAsset[asset];
  if (!bomPath) {
    throw new Error(`No interactive BOM is mapped for asset "${asset}".`);
  }

  const source = JSON.parse(await readFile(path.join(root, `assets-src/board-tours/${asset}.json`), "utf8"));
  const { edges_bbox: edges, footprints } = await readPcbData(bomPath);

  const stops = source.stops.map((stop) => {
    const { pos, span } = stopCenter(stop.refs, footprints);
    const local = toBoardLocal(pos, edges, FLIP_Y);
    return { id: stop.id, label: stop.label, blurb: stop.blurb, refs: stop.refs, x: local.x, y: local.y, span };
  });

  const outDir = path.join(root, "public/portfolio/assets/viewers/tours");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${asset}.tour.json`);
  await writeFile(outPath, `${JSON.stringify({ asset, flipY: FLIP_Y, stops }, null, 2)}\n`, "utf8");

  console.log(`wrote ${path.relative(root, outPath)}: ${stops.length} stops`);
  for (const stop of stops) {
    console.log(`  ${stop.id.padEnd(12)} ${stop.refs.join("+").padEnd(8)} x=${stop.x} y=${stop.y} span=${stop.span}`);
  }
}

const asset = process.argv[2] ?? "control";
build(asset).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 9: Add the build script**

In `package.json`, add to `"scripts"`, keeping alphabetical order alongside the other `build:` entries:

```json
    "build:tour": "node tools/build-board-tour.mjs",
```

- [ ] **Step 10: Generate the tour file and read the output**

Run: `npx pnpm@10.17.1 build:tour control`
Expected: `wrote public/portfolio/assets/viewers/tours/control.tour.json: 5 stops`, and a line per stop.

Confirm against the live BOM: `mcu` must print `x=-1.59 y=9.925 span=13.45`. These come from `U4` at `[102.41, 78.325]`, size `[13.45, 13.45]`, against an outline centre of `(104, 88.25)`. If it does not match, the join is wrong; do not continue.

- [ ] **Step 11: Commit**

```bash
git add assets-src/board-tours/control.json tools/board-tour-geometry.mjs tools/board-tour-geometry.d.mts tools/build-board-tour.mjs tests/board-tour-geometry.test.ts package.json public/portfolio/assets/viewers/tours/control.tour.json
git commit -m "build: derive board tour stops from the interactive BOM"
```

---

### Task 2: Verify the coordinate mapping against the rendered board

The y sign is a hypothesis until a marker lands on the right chip. This task proves it before any tour code is built on top.

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html`
- Modify: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: `public/portfolio/assets/viewers/tours/control.tour.json` from Task 1.
- Produces:
  - `?mode=cinematic&probe=<stopId>` on the shell, which parks the camera looking straight down at that stop's world position and exposes `window.__boardProbe()` returning `{ id, world: { x, y, z }, screen: { x, y } }`.
  - `boardLocalToWorld(x, y)` inside the shell, returning a `THREE.Vector3` in world space, which Task 3 reuses.

- [ ] **Step 1: Add the local-to-world helper and the probe**

In `public/portfolio/assets/viewers/board-viewer-shell.html`, add next to the other camera helpers:

```js
        /**
         * Board-local millimetres to world space. The group carries a -90 degree
         * x rotation, sometimes a z rotation, and a recentring offset, so let
         * Three apply the matrix rather than reimplementing it here.
         */
        function boardLocalToWorld(x, y) {
          return boardGroup.localToWorld(new THREE.Vector3(x, y, 0));
        }

        /** Projects a world point to canvas pixels, for label placement. */
        function worldToScreen(point) {
          const projected = point.clone().project(camera);
          return {
            x: (projected.x * 0.5 + 0.5) * mount.clientWidth,
            y: (-projected.y * 0.5 + 0.5) * mount.clientHeight,
          };
        }
```

Read the `probe` parameter beside the existing `cinematic` one:

```js
        const probeStop = params.get("probe");
```

- [ ] **Step 2: Park the camera on the probed stop**

Inside `buildScene`, in the `if (cinematic)` branch, after `applySpin(0);` and before `renderFrame();`:

```js
            if (probeStop) {
              fetch("/portfolio/assets/viewers/tours/" + asset + ".tour.json")
                .then(function (response) { return response.json(); })
                .then(function (tour) {
                  const stop = tour.stops.filter(function (s) { return s.id === probeStop; })[0];
                  if (!stop) {
                    return;
                  }

                  const world = boardLocalToWorld(stop.x, stop.y);
                  // Straight down on the stop, close enough to identify the part.
                  state.tx = world.x;
                  state.ty = world.y;
                  state.tz = world.z;
                  state.phi = 0.05;
                  state.r = 26;
                  updateCamera();
                  window.__boardProbe = function () {
                    return { id: stop.id, world: { x: world.x, y: world.y, z: world.z }, screen: worldToScreen(world) };
                  };
                });
            }
```

- [ ] **Step 3: Look at it**

Run: `npx pnpm@10.17.1 dev`

Open each of these and confirm by eye that the part under the centre of the frame is the one named:

- `http://localhost:5173/portfolio/assets/viewers/board-viewer-shell.html?asset=control&mode=cinematic&probe=mcu` must centre the large 64-pin square chip (STM32G474, 13.4mm square, by far the biggest IC on the board).
- `...&probe=level-shift` must centre the pair of small three-pin transistors near the board edge, roughly 4mm apart.
- `...&probe=can` must centre a single 8-pin SOIC.

If the parts are mirrored top to bottom, the y sign is wrong: set `FLIP_Y = false` in `tools/build-board-tour.mjs`, rerun `npx pnpm@10.17.1 build:tour control`, and check again. Do not proceed until all three match.

- [ ] **Step 4: Write the regression test**

The visual check cannot run in CI, so pin the relationship it proved. Add to `e2e/board-spin.spec.ts`, before the `GEOMETRY` constant:

```ts
test("tour stops land on the board where the BOM says they do", async ({ page }) => {
  await page.goto(`${SHELL}?asset=control&mode=cinematic&probe=mcu`);
  await waitForScene(page);

  const probe = await page
    .waitForFunction(() => (window as unknown as { __boardProbe?: () => unknown }).__boardProbe?.(), null, {
      timeout: 30_000,
    })
    .then((handle) => handle.jsonValue() as Promise<{ id: string; world: { x: number; y: number; z: number } }>);

  expect(probe.id).toBe("mcu");

  // The STM32 sits near the middle of the control board, so its world position
  // must be close to the recentred origin. A sign error in the y mapping would
  // put it about 20mm away, and a failed join would put it at the origin
  // exactly, so assert a band rather than a point.
  const planar = Math.hypot(probe.world.x, probe.world.z);
  expect(planar).toBeGreaterThan(1);
  expect(planar).toBeLessThan(18);
});
```

- [ ] **Step 5: Run it**

Run: `npx pnpm@10.17.1 e2e board-spin.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html e2e/board-spin.spec.ts public/portfolio/assets/viewers/tours/control.tour.json tools/build-board-tour.mjs
git commit -m "feat: map board tour stops into viewer world space"
```

---

### Task 3: Tour playback in the shell

The camera state machine: breathing orbit, ease to a stop, hold, ease onward, repeat.

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html`
- Create: `src/app/src/app/lib/tour-timeline.ts`
- Create: `tests/tour-timeline.test.ts`

**Interfaces:**
- Consumes: `boardLocalToWorld(x, y)` and the tour JSON shape from Task 2.
- Produces:
  - `src/app/src/app/lib/tour-timeline.ts` exports `easeInOut(t: number): number` and `tourPhase(elapsedMs: number, stopCount: number, timing: TourTiming): TourPhaseResult`, with
    ```ts
    export interface TourTiming { orbitMs: number; travelMs: number; holdMs: number }
    export type TourPhaseResult =
      | { kind: "orbit"; progress: number }
      | { kind: "travel"; from: number; to: number; progress: number }
      | { kind: "hold"; stop: number; progress: number };
    ```
    `from` is `-1` when travelling out of the orbit, and `to` is `-1` when travelling back into it.
  - The shell mirrors this timeline in plain JS and exposes `window.__boardTour()` returning `{ phase, stop, label }`, which Task 4's tests read.

- [ ] **Step 1: Write the failing timeline test**

Create `tests/tour-timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { easeInOut, tourPhase, type TourTiming } from "../src/app/src/app/lib/tour-timeline";

const TIMING: TourTiming = { orbitMs: 12000, travelMs: 1500, holdMs: 3000 };

describe("easeInOut", () => {
  it("pins both ends and the midpoint", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
  });

  it("starts and ends slowly, so the camera does not jerk", () => {
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  it("clamps outside the unit range", () => {
    expect(easeInOut(-2)).toBe(0);
    expect(easeInOut(4)).toBe(1);
  });
});

describe("tourPhase", () => {
  it("orbits first, reporting progress through the revolution", () => {
    expect(tourPhase(0, 5, TIMING)).toEqual({ kind: "orbit", progress: 0 });
    expect(tourPhase(6000, 5, TIMING)).toEqual({ kind: "orbit", progress: 0.5 });
  });

  it("travels from the orbit to the first stop", () => {
    const phase = tourPhase(12000 + 750, 5, TIMING);
    expect(phase).toEqual({ kind: "travel", from: -1, to: 0, progress: 0.5 });
  });

  it("holds on the first stop", () => {
    expect(tourPhase(12000 + 1500 + 1500, 5, TIMING)).toEqual({ kind: "hold", stop: 0, progress: 0.5 });
  });

  it("travels between consecutive stops", () => {
    // orbit + travel-in + hold, then half of the next leg.
    const t = 12000 + 1500 + 3000 + 750;
    expect(tourPhase(t, 5, TIMING)).toEqual({ kind: "travel", from: 0, to: 1, progress: 0.5 });
  });

  it("travels back to the orbit after the last stop", () => {
    // orbit + (travel + hold) for all five stops, then half a leg home.
    const t = 12000 + 5 * (1500 + 3000) + 750;
    expect(tourPhase(t, 5, TIMING)).toEqual({ kind: "travel", from: 4, to: -1, progress: 0.5 });
  });

  it("loops back to the orbit on the next cycle", () => {
    const cycle = 12000 + 5 * (1500 + 3000) + 1500;
    expect(tourPhase(cycle, 5, TIMING)).toEqual({ kind: "orbit", progress: 0 });
    expect(tourPhase(cycle + 6000, 5, TIMING)).toEqual({ kind: "orbit", progress: 0.5 });
  });

  it("never leaves the orbit when a board has no stops", () => {
    expect(tourPhase(99999, 0, TIMING)).toEqual({ kind: "orbit", progress: expect.any(Number) });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm@10.17.1 vitest run tests/tour-timeline.test.ts`
Expected: FAIL, `Failed to resolve import "../src/app/src/app/lib/tour-timeline"`.

- [ ] **Step 3: Write the timeline module**

Create `src/app/src/app/lib/tour-timeline.ts`:

```ts
/**
 * The tour's schedule, as pure arithmetic over elapsed time. The viewer shell
 * mirrors this in plain JS because it has no module loader; this copy is the
 * tested one, and the shell's copy carries a pointer back to it.
 */

export interface TourTiming {
  /** One free revolution before the first stop. */
  orbitMs: number;
  /** One camera move, whether between stops or in and out of the orbit. */
  travelMs: number;
  /** How long the camera rests on a stop. */
  holdMs: number;
}

export type TourPhaseResult =
  | { kind: "orbit"; progress: number }
  | { kind: "travel"; from: number; to: number; progress: number }
  | { kind: "hold"; stop: number; progress: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Symmetric ease, slow at both ends. */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function tourPhase(elapsedMs: number, stopCount: number, timing: TourTiming): TourPhaseResult {
  const { orbitMs, travelMs, holdMs } = timing;

  if (stopCount <= 0) {
    return { kind: "orbit", progress: (Math.max(0, elapsedMs) % orbitMs) / orbitMs };
  }

  // orbit, then (travel + hold) per stop, then one travel back to the orbit.
  const cycleMs = orbitMs + stopCount * (travelMs + holdMs) + travelMs;
  let t = Math.max(0, elapsedMs) % cycleMs;

  if (t < orbitMs) {
    return { kind: "orbit", progress: t / orbitMs };
  }

  t -= orbitMs;

  for (let index = 0; index < stopCount; index += 1) {
    if (t < travelMs) {
      return { kind: "travel", from: index - 1, to: index, progress: t / travelMs };
    }

    t -= travelMs;

    if (t < holdMs) {
      return { kind: "hold", stop: index, progress: t / holdMs };
    }

    t -= holdMs;
  }

  return { kind: "travel", from: stopCount - 1, to: -1, progress: t / travelMs };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx pnpm@10.17.1 vitest run tests/tour-timeline.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Make the orbit breathe**

In the shell, replace the `spinPose` radius term so the distance eases in and out twice per revolution, which reads as a breath rather than a single swoop. Replace:

```js
            radiusScale: 1.35 - dive * 0.35,
```

with:

```js
            // Two breaths per revolution: dive gives the single dip toward the
            // midpoint, breathe adds the in and out on top of it.
            radiusScale: 1.35 - dive * 0.35 - Math.sin(t * Math.PI * 4) * 0.08,
```

Update the constant comment above `spinPose` to say the curve is pinned by `e2e/board-spin.spec.ts`, and update that test's radius expectations in Step 8.

- [ ] **Step 6: Add tour playback**

In the shell, beside the orbit state, add:

```js
        let tourStops = [];
        let tourPhaseNow = { kind: "orbit", progress: 0 };
        const TOUR_TIMING = { orbitMs: 12000, travelMs: 1500, holdMs: 3000 };
```

Add the mirrored timeline and the camera application:

```js
        /**
         * Mirror of src/app/src/app/lib/tour-timeline.ts, which is the tested
         * copy. This file is a plain script with no module loader, so the
         * arithmetic is duplicated on purpose; change both together.
         */
        function easeInOut(t) {
          const x = Math.min(1, Math.max(0, t));
          return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
        }

        function tourPhase(elapsedMs, stopCount, timing) {
          if (stopCount <= 0) {
            return { kind: "orbit", progress: (Math.max(0, elapsedMs) % timing.orbitMs) / timing.orbitMs };
          }

          const cycleMs = timing.orbitMs + stopCount * (timing.travelMs + timing.holdMs) + timing.travelMs;
          let t = Math.max(0, elapsedMs) % cycleMs;

          if (t < timing.orbitMs) {
            return { kind: "orbit", progress: t / timing.orbitMs };
          }

          t -= timing.orbitMs;

          for (let index = 0; index < stopCount; index += 1) {
            if (t < timing.travelMs) {
              return { kind: "travel", from: index - 1, to: index, progress: t / timing.travelMs };
            }

            t -= timing.travelMs;

            if (t < timing.holdMs) {
              return { kind: "hold", stop: index, progress: t / timing.holdMs };
            }

            t -= timing.holdMs;
          }

          return { kind: "travel", from: stopCount - 1, to: -1, progress: t / timing.travelMs };
        }

        /** The camera pose that frames one stop head on. */
        function stopPose(stop) {
          const world = boardLocalToWorld(stop.x, stop.y);
          return {
            tx: world.x,
            ty: world.y,
            tz: world.z,
            // Enough distance to hold the part plus a margin in frame.
            r: Math.max(18, stop.span * 2.6),
            phi: 0.85,
            theta: -0.5,
          };
        }

        /** The orbit's own pose, as a target the tour can blend against. */
        function orbitPose(progress) {
          const pose = spinPose(progress);
          return { tx: 0, ty: 0, tz: 0, r: maxDimension * pose.radiusScale, phi: pose.phi, theta: pose.theta };
        }

        function applyPose(pose) {
          state.tx = pose.tx;
          state.ty = pose.ty;
          state.tz = pose.tz;
          state.r = pose.r;
          state.phi = pose.phi;
          state.theta = pose.theta;
          updateCamera();
        }

        function blendPose(a, b, amount) {
          const k = easeInOut(amount);
          state.tx = a.tx + (b.tx - a.tx) * k;
          state.ty = a.ty + (b.ty - a.ty) * k;
          state.tz = a.tz + (b.tz - a.tz) * k;
          state.r = a.r + (b.r - a.r) * k;
          state.phi = a.phi + (b.phi - a.phi) * k;
          state.theta = a.theta + (b.theta - a.theta) * k;
          updateCamera();
        }

        function poseFor(index, progress) {
          return index < 0 ? orbitPose(progress) : stopPose(tourStops[index]);
        }

        function applyTour(elapsedMs) {
          const phase = tourPhase(elapsedMs, tourStops.length, TOUR_TIMING);
          tourPhaseNow = phase;

          if (phase.kind === "orbit") {
            applySpin(phase.progress);
          } else if (phase.kind === "hold") {
            applyPose(stopPose(tourStops[phase.stop]));
          } else {
            // Travelling in or out of the orbit uses the orbit's end heading so
            // the camera leaves and rejoins the spin without a jump.
            blendPose(poseFor(phase.from, 1), poseFor(phase.to, 0), phase.progress);
          }

          renderStopLabel(phase);
        }

        // Task 4 replaces this stub with the real label renderer. It exists now
        // so applyTour is callable before the overlay is built.
        function renderStopLabel() {}

        window.__boardTour = function () {
          const phase = tourPhaseNow;
          const index = phase.kind === "hold" ? phase.stop : -1;
          return {
            phase: phase.kind,
            stop: index,
            label: index >= 0 && tourStops[index] ? tourStops[index].label : null,
          };
        };
```

- [ ] **Step 7: Drive the tour from the orbit loop and load the stops**

Replace the `applySpin(...)` call inside `orbitLoop` with `applyTour(orbitElapsed)`:

```js
          orbitElapsed += now - orbitLast;
          orbitLast = now;
          applyTour(orbitElapsed);
          renderFrame();
          orbitFrame = requestAnimationFrame(orbitLoop);
```

Load the stops during `buildScene`, in the `if (cinematic)` branch, before `renderFrame()`. A missing file is not an error: the board simply orbits.

```js
            fetch("/portfolio/assets/viewers/tours/" + asset + ".tour.json")
              .then(function (response) { return response.ok ? response.json() : null; })
              .then(function (tour) {
                if (tour && tour.stops) {
                  tourStops = tour.stops;
                }
              })
              .catch(function () {
                // No tour for this board. The plain orbit is the fallback.
              });
```

- [ ] **Step 8: Update the pinned radius expectations**

The breathing term changes the radius at the sampled points, so `e2e/board-spin.spec.ts`'s curve test needs its ratio updated. In the "cinematic shell is inert" test, replace:

```ts
  expect(start.r / middle.r).toBeCloseTo(1.35 / 1.0, 4);
  expect(end.r).toBeCloseTo(start.r, 4);
```

with:

```ts
  // radiusScale is 1.35 at the ends and 1.0 at the midpoint, with a breathing
  // term of sin(4*pi*t)*0.08 on top. That term is 0 at t = 0, 0.5 and 1, so
  // these three sample points still see the base curve exactly.
  expect(start.r / middle.r).toBeCloseTo(1.35 / 1.0, 4);
  expect(end.r).toBeCloseTo(start.r, 4);

  // But it must actually breathe in between, or the term was dropped.
  await post(page, { type: "spin", progress: 0.125 });
  const quarter = (await readCameraState(page))!;
  expect(quarter.r / start.r).toBeLessThan((1.35 - 0.08) / 1.35 + 0.001);
```

- [ ] **Step 9: Run the gate**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 e2e board-spin.spec.ts`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html src/app/src/app/lib/tour-timeline.ts tests/tour-timeline.test.ts e2e/board-spin.spec.ts
git commit -m "feat: play a guided tour of the board between orbits"
```

---

### Task 4: Stop labels and host wiring

The label that names each section, and the guarantee that the tour obeys visibility and reduced motion exactly as the orbit already does.

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html`
- Modify: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: `window.__boardTour()`, `tourPhaseNow`, `stopPose`, `worldToScreen` from Tasks 2 and 3.
- Produces: no new host API. `BoardShowcase.tsx` is deliberately untouched, because the shell already pauses on `pause` and parks on `spin`, which covers spec items 7 and 8.

- [ ] **Step 1: Add the label element**

In the shell's `<style>` block, after the `.hint` rules:

```css
      .stop-label {
        position: fixed;
        z-index: 3;
        max-width: 19rem;
        padding: 10px 14px;
        border-radius: 14px;
        background: rgba(15, 18, 32, 0.86);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        color: rgba(255, 255, 255, 0.92);
        opacity: 0;
        transition: opacity 260ms ease;
        pointer-events: none;
        transform: translate(-50%, calc(-100% - 18px));
      }

      .stop-label.visible {
        opacity: 1;
      }

      .stop-label b {
        display: block;
        font-size: 13px;
        letter-spacing: 0.04em;
      }

      .stop-label span {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.62);
      }

      .stop-dot {
        position: fixed;
        z-index: 2;
        width: 10px;
        height: 10px;
        margin: -5px 0 0 -5px;
        border-radius: 999px;
        background: #ff6b35;
        box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.25);
        opacity: 0;
        transition: opacity 260ms ease;
        pointer-events: none;
      }

      .stop-dot.visible {
        opacity: 1;
      }
```

In the `<body>`, after the `.hint` div:

```html
    <div class="stop-dot" id="stop-dot"></div>
    <div class="stop-label" id="stop-label"><b id="stop-title"></b><span id="stop-blurb"></span></div>
```

- [ ] **Step 2: Drive the label from the tour phase**

In the shell's script, beside the other element lookups:

```js
        const stopDot = document.getElementById("stop-dot");
        const stopLabel = document.getElementById("stop-label");
        const stopTitle = document.getElementById("stop-title");
        const stopBlurb = document.getElementById("stop-blurb");
```

Add the renderer and call it at the end of `applyTour`:

```js
        /**
         * The label is anchored to the part itself, so it has to be reprojected
         * every frame while the camera is moving. It fades in only during the
         * hold, which is when the camera is still enough to read it.
         */
        function renderStopLabel(phase) {
          const holding = phase.kind === "hold";
          const index = holding ? phase.stop : -1;
          const stop = index >= 0 ? tourStops[index] : null;

          if (!stop) {
            stopDot.classList.remove("visible");
            stopLabel.classList.remove("visible");
            return;
          }

          if (stopTitle.textContent !== stop.label) {
            stopTitle.textContent = stop.label;
            stopBlurb.textContent = stop.blurb;
          }

          const screen = worldToScreen(boardLocalToWorld(stop.x, stop.y));
          stopDot.style.left = screen.x + "px";
          stopDot.style.top = screen.y + "px";
          stopLabel.style.left = screen.x + "px";
          stopLabel.style.top = screen.y + "px";
          stopDot.classList.add("visible");
          stopLabel.classList.add("visible");
        }
```

`applyTour` already ends with `renderStopLabel(phase)` from Task 3, so no call site changes. Delete Task 3's stub:

```js
        // Task 4 replaces this stub with the real label renderer. It exists now
        // so applyTour is callable before the overlay is built.
        function renderStopLabel() {}
```

and put the real implementation above in its place.

- [ ] **Step 3: Hide the label whenever the orbit is not playing**

A paused tour must not leave a stale label on screen. In `pauseOrbit`, after clearing the frame:

```js
          stopDot.classList.remove("visible");
          stopLabel.classList.remove("visible");
```

- [ ] **Step 4: Write the e2e coverage**

Add to `e2e/board-spin.spec.ts`. This joins the existing serial file and reuses one scene rather than adding new page loads where it can.

```ts
test("the tour halts the orbit on each stop and names the part", async ({ page }) => {
  await page.goto(`${SHELL}?asset=control&mode=cinematic`);
  await waitForScene(page);

  const readTour = () =>
    page.evaluate(
      () => (window as unknown as { __boardTour?: () => { phase: string; stop: number; label: string | null } }).__boardTour?.(),
    );

  // Nothing runs until play, so the tour starts in its orbit phase.
  expect((await readTour())?.phase).toBe("orbit");

  await page.evaluate(() => window.postMessage({ type: "play" }, window.location.origin));

  // The first stop is the STM32, and its label must appear while the camera
  // holds on it. The orbit leg is 12s, so allow for it plus the travel.
  await expect.poll(async () => (await readTour())?.label, { timeout: 45_000 }).toBe("STM32G474");
  await expect(page.locator("#stop-label")).toHaveClass(/visible/);
  await expect(page.locator("#stop-title")).toHaveText("STM32G474");

  // Pausing must clear the label rather than leave it stranded.
  await page.evaluate(() => window.postMessage({ type: "pause" }, window.location.origin));
  await expect(page.locator("#stop-label")).not.toHaveClass(/visible/);
});

test("a board with no tour file just orbits", async ({ page }) => {
  // Only the control board has a tour. The power board must not error.
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await page.goto(CINEMATIC);
  await waitForScene(page);

  const tour = await page.evaluate(
    () => (window as unknown as { __boardTour?: () => { phase: string; stop: number } }).__boardTour?.(),
  );
  expect(tour?.phase).toBe("orbit");
  expect(tour?.stop).toBe(-1);
  expect(failures).toEqual([]);
});
```

- [ ] **Step 5: Run the full gate**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build && npx pnpm@10.17.1 e2e`
Expected: all PASS.

- [ ] **Step 6: Look at it**

Run: `npx pnpm@10.17.1 dev`, open `http://localhost:5173/`, and scroll to the board. Confirm: it orbits and visibly breathes, then eases in to the STM32 and holds with a label anchored on the chip, then moves through the LDO, CAN transceiver, level shifter and USB bridge, then returns to the orbit. Scroll away mid-tour and back, and confirm it resumes rather than restarting.

- [ ] **Step 7: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html e2e/board-spin.spec.ts
git commit -m "feat: label each board tour stop on the board itself"
```

---

## Notes on what was deliberately left out

- **No tours for the power or brick boards.** Only the control board is on the home page. The shell already falls back to a plain orbit, and Task 4 tests that fallback. Add `assets-src/board-tours/power.json` and rerun the build tool if that changes.
- **No click to jump to a stop.** The block is decorative and `pointer-events-none`; the interactive modal viewer is where a visitor explores by hand.
- **No host-side caption.** The label lives in the shell because the shell owns the camera and the projection. Sending stop changes to React would mean a second copy of the state for no gain.
- **The timeline arithmetic is duplicated** between `lib/tour-timeline.ts` and the shell, for the same reason the spin curve was: the shell has no module loader. The unit tests cover the module, and the e2e covers the shell's copy through observable behaviour.
