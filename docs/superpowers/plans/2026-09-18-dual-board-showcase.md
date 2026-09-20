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

Add this test to `e2e/board-spin.spec.ts`, directly after the existing test named `"the shell's tour timeline matches the pinned fixture table"`:

```ts
test("the shell announces each completed tour cycle to its host", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  // The cycle length is the timeline's own arithmetic, so it is pinned here
  // rather than recomputed in the component that consumes the message.
  const cycles = await page.evaluate(() => {
    const fn = (window as unknown as { __tourCycleMs?: (n: number, t: unknown) => number }).__tourCycleMs!;
    const t = (window as unknown as { __tourTiming?: unknown }).__tourTiming;
    return [fn(0, t), fn(4, t), fn(5, t)];
  });

  // No stops: the bare orbit is the whole cycle. Otherwise orbit, then a
  // travel and a hold per stop, then the travel back out to the orbit.
  expect(cycles).toEqual([12000, 12000 + 4 * 4500 + 1500, 12000 + 5 * 4500 + 1500]);

  // And the message actually fires. The power board has no tour file, so its
  // cycle is the bare 12s orbit: one wrap is cheap to wait for.
  const announced = await page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("no tour-cycle message within 40s")), 40_000);
      window.addEventListener("message", function onMessage(event) {
        if ((event.data as { type?: unknown } | null)?.type !== "tour-cycle") {
          return;
        }

        window.removeEventListener("message", onMessage);
        clearTimeout(deadline);
        resolve("tour-cycle");
      });

      window.postMessage({ type: "play" }, window.location.origin);
    });
  });

  expect(announced).toBe("tour-cycle");
});
```

Note on the second half: the shell's `notifyHost` returns early when `window.parent === window`, which is true for a top-level page. Step 3 changes `notifyHost` to post to `window` itself in that case, which is what makes this test observable without an iframe harness. That is deliberate and is also what makes the message visible to a same-origin listener in the embedding page.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "announces each completed tour cycle"`

Expected: FAIL. The first `page.evaluate` throws because `window.__tourCycleMs` is `undefined`, so the error reads roughly `TypeError: fn is not a function`.

- [ ] **Step 3: Implement the cycle length helper and the announcement**

In `public/portfolio/assets/viewers/board-viewer-shell.html`:

(a) Add a `lastCycleIndex` to the mutable state block, immediately after the existing `let tourPhaseNow = { kind: "orbit", progress: 0 };` line:

```js
        let tourPhaseNow = { kind: "orbit", progress: 0 };
        // Which cycle of the tour timeline the last applied frame fell in, so
        // a wrap can be announced exactly once. -1 means nothing applied yet,
        // which keeps the very first frame from counting as a completed cycle.
        let lastCycleIndex = -1;
```

(b) Add `tourCycleMs` immediately above the existing `function tourPhase(elapsedMs, stopCount, timing) {`, and make `tourPhase` use it so there is only one copy of the arithmetic:

```js
        /**
         * How long one full pass of the timeline takes: the orbit, then a
         * travel and a hold for each stop, then the travel back out. A board
         * with no tour file has no stops, so its cycle is the bare orbit.
         */
        function tourCycleMs(stopCount, timing) {
          if (stopCount <= 0) {
            return timing.orbitMs;
          }

          return timing.orbitMs + stopCount * (timing.travelMs + timing.holdMs) + timing.travelMs;
        }
```

Then inside `tourPhase`, replace the line

```js
          const cycleMs = timing.orbitMs + stopCount * (timing.travelMs + timing.holdMs) + timing.travelMs;
```

with

```js
          const cycleMs = tourCycleMs(stopCount, timing);
```

(c) In `applyTour`, announce a wrap. Replace the whole existing function body's first two lines:

```js
        function applyTour(elapsedMs) {
          const phase = tourPhase(elapsedMs, tourStops.length, TOUR_TIMING);
          tourPhaseNow = phase;
```

with:

```js
        function applyTour(elapsedMs) {
          const phase = tourPhase(elapsedMs, tourStops.length, TOUR_TIMING);
          tourPhaseNow = phase;

          // The host swaps to the next board on this, so it has to fire on the
          // wrap itself rather than on a phase transition: a board with no tour
          // file never leaves the orbit phase and would otherwise never hand over.
          const cycleIndex = Math.floor(Math.max(0, elapsedMs) / tourCycleMs(tourStops.length, TOUR_TIMING));
          if (cycleIndex !== lastCycleIndex) {
            if (lastCycleIndex >= 0) {
              notifyHost("tour-cycle");
            }

            lastCycleIndex = cycleIndex;
          }
```

Leave the rest of `applyTour` (the `if (phase.kind === "orbit")` chain and `renderStopLabel(phase)`) exactly as it is.

(d) The tour fetch resets `orbitElapsed` when stops arrive late, which changes which cycle the clock is in. Reset the counter with it. In the `.then` handler, immediately after the existing line `orbitElapsed %= TOUR_TIMING.orbitMs;`, add:

```js
                  // The cycle length just changed underneath the counter, so
                  // the index it holds is from the old, stop-free timeline.
                  lastCycleIndex = -1;
```

(e) Make `notifyHost` observable at the top level, so the message can be tested without an iframe and so a same-origin host sees it either way. Replace:

```js
        function notifyHost(type) {
          if (window.parent === window) {
            return;
          }

          window.parent.postMessage({ type: type }, window.location.origin);
        }
```

with:

```js
        function notifyHost(type) {
          // Top level (no embedding page) posts to itself, so the shell's own
          // page can observe the same messages an embedder would receive.
          const target = window.parent === window ? window : window.parent;
          target.postMessage({ type: type }, window.location.origin);
        }
```

(f) Expose the helper alongside the existing cinematic-only test hooks. In `buildScene`, immediately after the existing line `window.__applyTour = applyTour;` (which is the last of that hook block, below `window.__tourPhase` and `window.__tourTiming`), add:

```js
            window.__tourCycleMs = tourCycleMs;
```

Note on `__applyTour`: it is a test hook that drives `applyTour` at an arbitrary elapsed time. With this task's change in place, stepping it across a cycle boundary now also posts a `tour-cycle` message, and stepping it backwards changes `lastCycleIndex` without posting. Neither affects the existing test that uses it, which walks a single leg inside cycle 0. Do not add a guard for it; the hook is test-only and the behaviour is correct.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx pnpm@10.17.1 exec playwright test e2e/board-spin.spec.ts -g "announces each completed tour cycle"`

Expected: PASS.

- [ ] **Step 5: Verify the test actually bites**

Temporarily change the `if (lastCycleIndex >= 0) {` guard in `applyTour` to `if (false) {`, rerun the same command, and confirm it fails with `no tour-cycle message within 40s`. Then restore the guard and rerun to confirm PASS again. Do not commit the temporary change.

- [ ] **Step 6: Run the full suite**

Run: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 e2e`

Expected: typecheck exits 0, all unit tests pass, all e2e tests pass. The pre-existing tests in `board-spin.spec.ts` must still pass: `notifyHost` now also fires on a top-level page, and nothing in those tests listens for messages.

- [ ] **Step 7: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html e2e/board-spin.spec.ts
git commit -m "$(cat <<'EOM'
feat: announce each completed tour cycle from the viewer shell

The showcase needs to know when a board has finished its whole tour so it
can hand over to the next board. The shell already owns every constant in
the timeline, so it computes the cycle length and posts the wrap rather
than React re-deriving the arithmetic.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOM
)"
```

---

## Task 2: The Brick Buck Board gets its own tour

**Files:**
- Edit: `assets-src/board-tours/brick.json` (new source entry for the existing tour build)
- Generated: `public/portfolio/assets/viewers/tours/brick.tour.json`
- Test: `e2e/board-spin.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `public/portfolio/assets/viewers/tours/brick.tour.json`, matching the schema the shell already reads:
  `{ asset: string, stops: Array<{ id: string, label: string, blurb: string, x: number, y: number, span: number }> }`.
  `x` and `y` are millimetres in the `.pcbgeo` model's own coordinate space. `span` is the part's largest footprint dimension in millimetres; the shell uses it as `r = Math.max(20, span * 1.5)`.

### Background the executor needs

**There is already a tour build pipeline. Do not write a second one.** `npx pnpm@10.17.1 build:tour <asset>` runs `tools/build-board-tour.mjs`, which:

- reads `assets-src/board-tours/<asset>.json`, the hand-written source: `{ asset, stops: [{ id, label, blurb, refs: [ref, ...] }] }`, where `refs` names one or more footprints by reference designator and a multi-ref stop frames their union;
- looks the asset up in its own `bomByAsset` map (`power`, `control` and `brick` are all already wired to their `public/portfolio/assets/bom/*/IBOM.html`);
- loads that IBOM in Playwright's bundled Chromium, because the page stores `pcbdata` LZString-compressed in a script tag and there is no reliable way to parse it off disk;
- converts through `tools/board-tour-geometry.mjs` (pure, unit tested in `tests/board-tour-geometry.test.ts`, typed by `tools/board-tour-geometry.d.mts`);
- writes `public/portfolio/assets/viewers/tours/<asset>.tour.json` and prints each stop.

The generated files are checked in, and `tests/board-tour-sync.test.ts` asserts each one still matches the source it was built from, so regenerate rather than hand-editing.

**How a stop becomes a camera pose.** The shell's `stopPose(stop)` calls `boardLocalToWorld(stop.x, stop.y)`, which is `boardGroup.localToWorld(new THREE.Vector3(x, y, 0))`. `buildScene` recentres the board with `boardGroup.position.sub(center)`, which moves the group, not its local coordinates. So `x` and `y` are raw `.pcbgeo` model coordinates, untouched by recentring and untouched by the group's rotations.

The `.pcbgeo` files are written by `tools/build-board-geometry-bin.mjs` straight from the source model with no recentring, and both boards happen to be roughly origin-centred in that space. Measured bounding boxes:

- `control.pcbgeo`: x from -31.00 to 32.28, y from -37.25 to 37.25
- `brick.pcbgeo`: x from -79.40 to 78.59, y from -79.70 to 78.95

**Page coordinates to model coordinates.** The IBOM describes the same physical board in KiCad page coordinates: origin elsewhere, and y increasing downward. The brick board's outline bbox is `{ minx: 15.575, miny: 14.025, maxx: 173.617317, maxy: 172.37193 }`, the same 158mm square. `toBoardLocal` therefore does:

```
x_model =   (x_ibom - (minx + maxx) / 2)
y_model = - (y_ibom - (miny + maxy) / 2)
```

**Where a footprint actually is.** This is the part that is easy to get wrong, so it is worth stating exactly. A footprint's `bbox` has four fields, and the IBOM's own canvas code draws the box like this:

```js
ctx.translate(...footprint.bbox.pos);
ctx.rotate(deg2rad(-footprint.bbox.angle));
ctx.translate(...footprint.bbox.relpos);
ctx.fillRect(0, 0, ...footprint.bbox.size);
```

So `pos` is the footprint's **placement origin**, not a corner and not the centre. The box occupies `relpos` to `relpos + size` in a frame rotated by `-angle` about `pos`. `stopCenter` reproduces that, mapping all four corners into page space and taking their axis-aligned bounds.

The trap: for a footprint whose origin sits at its own centre, `relpos === -size / 2` exactly, and the box centre lands back on `pos`. That holds for every stop on the control board, which is why an earlier version of `stopCenter` that simply treated `pos` as the centre produced a correct `control.tour.json` and looked right. It does not hold in general. On the brick board 48 of 108 footprints break it, and two of the four candidate stops do: `J11` has `relpos [-3.075, -8.255]` against a `-size / 2` of `[-15.58, -13.255]`, putting its true centre 13mm from `pos`, and `K1` is 9mm out. Most parts also carry `angle` 90 or 180. Do not reintroduce the shortcut, and do not "correct" it by adding `size / 2` to `pos`, which is wrong by half a part in the other direction.

Step 4 below verifies all of this by eye rather than taking it on trust.

- [ ] **Step 1: Add the brick board's tour source**

Create `assets-src/board-tours/brick.json` alongside the existing `control.json`, which is the model for its shape:

```json
{
  "asset": "brick",
  "stops": [
    { "id": "<id>", "label": "<label>", "blurb": "<blurb>", "refs": ["<REF>"] }
  ]
}
```

Nothing else needs creating. `bomByAsset` in `tools/build-board-tour.mjs` already maps `brick` to `public/portfolio/assets/bom/brick-buck/IBOM.html`.

- [ ] **Step 2: List the footprints and pick the stops**

The build tool prints only the stops you asked for, so to survey the board first, dump the same `pcbdata` it reads. A throwaway script is fine here and should not be committed: launch `chromium` from `@playwright/test`, `goto` the IBOM as a `file://` URL with `page.on("pageerror", () => {})` (the page throws on its own optional features when loaded from disk), wait for `window.pcbdata`, then read `edges_bbox`, each footprint's `ref`, `layer` and `bbox`, and the BOM's part fields at `pcbdata.bom.fields` (keyed by footprint index, so map it back through the `footprints` array). Run each candidate through `stopCenter` and `toBoardLocal` to get its model-space centre and span, and sort by span.

Expected: the two `KUB4812_QB-10A` brick modules are the largest footprints at span 59.9.

Now choose **four** stops. Four keeps the brick's cycle at `12000 + 4 * 4500 + 1500 = 31500`ms, so the pair of boards loops in just over a minute rather than well over two. Pick one footprint for each of these four subsystems. Confirm each reference designator is the part you think it is: the BOM fields give the manufacturer part number and footprint name, and the 3D render carries the board's own silkscreen legends, which name most subsystems outright.

1. **The Mornsun 48V to 12V brick.** One of the two `KUB4812_QB-10A` footprints. Pick whichever is on the front (`F`) layer and nearer the board centre, and check that its footprint extent stays inside the outline (half-width 79.02mm).
2. **The on-board 12V to 5V buck.** Find the switching regulator IC and its inductor. Use the IC footprint.
3. **Circuit protection.** One of the `F1`..`F6` fuse footprints, span 19.85. Pick one that is not visually crowded by a tall neighbour.
4. **Power entry and distribution.** The largest front-layer connector, `J11` at span 31.16, or the e-stop relay `K1` at span 20.63. Read the silkscreen before writing the copy: `J11` is legended `BATTERY` and is the pack inlet, not an output header.

Record the chosen `ref` for each, and put them in the `refs` arrays from Step 1. Then run `npx pnpm@10.17.1 build:tour brick` and check the printed `x`, `y` and `span`.

- [ ] **Step 3: Write the copy and generate the tour file**

The copy lives in the source, `assets-src/board-tours/brick.json`, next to the `refs` chosen in Step 2. Never hand-write `public/portfolio/assets/viewers/tours/brick.tour.json`: it is a build artifact, `tests/board-tour-sync.test.ts` asserts it still matches its source, and any hand edit is lost the next time anyone runs `build:tour`.

Write the `label` and `blurb` from the part's actual identity in the IBOM and the Brick Buck Board copy in `src/app/src/app/data/portfolio.ts` (slug `brick-buck-board`), matching the register of `control.json`: one short noun phrase for the label, and two sentences at most for the blurb, the first naming the part and the second saying what it does on this board. **No em-dashes.** Check each claim against the board rather than trusting the sample below, which shows the register and the shape, not facts you may reuse.

```json
{
  "asset": "brick",
  "stops": [
    {
      "id": "brick-converter",
      "label": "48V to 12V brick",
      "blurb": "A premade Mornsun KUB4812 brick module. It replaces the custom 48V to 12V stage, so this backup board never had to re-solve the high voltage conversion.",
      "refs": ["KUB4812_QB-10A2"]
    },
    {
      "id": "buck-5v",
      "label": "12V to 5V buck",
      "blurb": "A TPS54824 synchronous buck regulator with its output inductor alongside. This is the one power stage kept custom, sized around the low voltage loads on the kart.",
      "refs": ["U2"]
    },
    {
      "id": "protection",
      "label": "Circuit protection",
      "blurb": "A blade fuse holder on the 48V to 12V branch. Six of them split the board into separately fused branches, so a fault in one subsystem clears locally instead of dropping the whole kart.",
      "refs": ["F6"]
    },
    {
      "id": "battery-input",
      "label": "Battery input",
      "blurb": "The Mini-Fit Sr connector marked BATTERY. All pack current enters the board here before it is split between the brick converters and the fused subsystem outputs.",
      "refs": ["J11"]
    }
  ]
}
```

Then generate, and review the numbers it prints:

```bash
npx pnpm@10.17.1 build:tour brick
```

Each stop's `x` and `y` should be inside the board's half extent of about 79mm, and `span` should match the part's largest footprint dimension. Step 5's test pins the `brick-converter` id, so keep that one; the rest are free to rename.

- [ ] **Step 4: Verify every stop visually with the probe hook**

The shell has a `?probe=<stop id>` mode that parks the camera straight down on a stop. Start the dev server and screenshot each stop.

```bash
npx pnpm@10.17.1 dev
```

Then, for each of the four ids (`brick-converter`, `buck-5v`, `protection`, `battery-input`), open:

`http://localhost:5173/portfolio/assets/viewers/board-viewer-shell.html?asset=brick&mode=cinematic&probe=<id>`

Expected for each: the named part is centred in frame and is the part the label claims. If a stop lands on empty board or on a neighbouring part, the `x`/`y` are wrong. Re-check against the tool output and against the IBOM's own canvas, which highlights a footprint when you click its BOM row.

This is also the step that confirms the box geometry described above. A stop offset by roughly half the part means `stopCenter` has stopped following `relpos` and `angle`, and the fix is in `tools/board-tour-geometry.mjs`, not in the numbers. Do not paper over it by shifting the stop by hand: the generated file is rebuilt from source and any hand edit is lost on the next `build:tour`.

- [ ] **Step 5: Write the failing test**

Add this test to `e2e/board-spin.spec.ts`, directly after the existing test named `"tour stops land on the board where the BOM says they do"`. Replace `EXPECTED_X` and `EXPECTED_Z` with the world coordinates the probe reports in Step 6.

Keep it to the probe assertion, which is the only part that needs a rendered scene. Anything that merely reads the tour JSON belongs in `tests/board-tour-sync.test.ts`, which already asserts copy, ids, ordering, board bounds and span for every asset without a browser. A WebGL context and a multi-megabyte geometry load are the most expensive test class in this repo, and `pages.yml` runs the e2e suite on the deploy-gating path, so do not put browser-free assertions here.

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

`showcaseBoards` is imported from `../data/portfolio`, not computed in this component. CLAUDE.md
makes `portfolio.ts` the single source of truth for page content, and which boards the showcase
plays (and in what order) is content, so it is a derived export there, added right after
`featuredBoardProjects`:

```ts
// The two boards that have a guided tour, in the order the homepage showcase
// plays them. Driven by slug rather than by featured order so that featuring
// another board does not silently change what the homepage animates.
const SHOWCASE_SLUGS = ["aux-control-board", "brick-buck-board"];

export const showcaseBoards: ShowcaseBoard[] = SHOWCASE_SLUGS.flatMap((slug) => {
  const project = getProjectBySlug(slug);
  return project?.viewerAsset ? [{ asset: project.viewerAsset, title: project.title }] : [];
});
```

`featuredBoardProjects` and `showcaseBoards` are both imported in `Home.tsx`. Confirm no other import needs adding.

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
