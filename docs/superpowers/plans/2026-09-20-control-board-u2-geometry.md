# Control Board U2 Geometry Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get U2 (TLV76733DRVR, WSON-6) into the shipped control board 3D model without shifting the model's coordinate space, which would silently misaim every guided-tour camera.

**Architecture:** Restore the deleted VRML→bundle converter, prove it reproduces the committed `PCB_GEO_BRICK` before trusting it, then run it against a correctly-originated control board export. Coordinate-space invariants are locked into tests *before* any artifact changes, so drift fails a test instead of shipping.

**Tech Stack:** Node 20+, pnpm 10.17.1 (always pinned), `three` (VRMLLoader, re-added as a devDependency), Vitest, Playwright.

**Spec:** No separate spec doc. The design was settled by measurement in the 2026-09-20 session; the findings it argues from are reproduced in "Measured Facts" below so this plan stands alone.

## Global Constraints

- Package manager invocation is always `npx pnpm@10.17.1 …`, never `@latest` — a newer pnpm major has silently dropped the `pnpm.overrides` block that pins `vite@6.3.5` and aliases `rollup` → `@rollup/wasm-node`, which breaks the build.
- `three` is a **devDependency only**. It must never reach the app bundle; the viewer loads its own Three inside `board-viewer-shell.html`.
- Gates before any commit that touches geometry: `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build`.
- `public/portfolio/assets/viewers/tours/*.tour.json` are generated. Never hand-edit; regenerate with `npx pnpm@10.17.1 build:tour <asset>`.
- No em-dashes in any portfolio copy (`data/portfolio.ts`, tour blurbs).
- The e2e preview run gates the Pages deploy. A failing bundle e2e blocks release; fix the test's determinism, never move the step after upload.

## Measured Facts

These were measured this session. They are the reason the plan is shaped this way.

1. **The new export has the wrong origin.** Both control exports have identical spans (X 24.4094, Y 29.3307 VRML units) but different centers:

   | file | X center | Y center |
   |---|---|---|
   | `Control Board POC.wrl` (Mar 24) | `0.0000` | `0.0000` |
   | `Control Board.wrl` (Sep 20) | `3.5433` | `1.8701` |

   VRML unit here is 0.1 inch = 2.54 mm, so the new export is offset ≈ **9.00 mm, 4.75 mm**. The `ldo` tour stop has `span` 3.512 mm — that offset moves the camera clean off the part.

2. **The viewer recenters, the tour generator does not agree with it.** `board-viewer-shell.html:839-841` does `box.getCenter(center); boardGroup.position.sub(center)` — recentering on the *whole mesh* bounding box, tall connectors included. `tools/board-tour-geometry.mjs` centers on the *board outline*. They coincide today only because the Mar 24 export was board-centered. Any change to which meshes exist can move the mesh bbox and desync them.

3. **The converter's scale constant cannot reproduce the shipped bundle.** `BRICK_BUNDLE_SCALE = 1000` applied to the tracked `brick-buck-board.wrl` (X span 62.2017) yields 62201, but the committed `PCB_GEO_BRICK` spans 158 mm (a 2.54× relationship). So the tracked WRL and the shipped bundle came from exports in *different units*. The tool is not known-good; Task 2 is a gate, not a formality.

4. **Current committed bundle bounds** (`assets-src/board-geometry/board-model-data.js`):

   | board | meshes | X | Y | Z |
   |---|---|---|---|---|
   | power | 30 | −67.45 .. 67.45 | −55.85 .. 56.65 | −9.15 .. 16.80 |
   | control | 22 | −31.00 .. 32.28 | −37.25 .. 37.25 | −4.30 .. 13.60 |
   | brick | 40 | −79.40 .. 78.59 | −79.70 .. 78.95 | −16.20 .. 16.80 |

5. **U2 is correctly modeled upstream already.** `shapes3D/TLV76733DRVR.wrl` measures 2.000 × 0.800 × 2.000 mm (WSON-6, `DRV` = WSON-6 2.0×2.0×0.8, *not* SOT-23-6). Its `(rotate (xyz -90 0 0))` is correct; Y min is exactly 0, so it sits flush. No KiCad-side work remains except the export origin.

6. The Sep 20 re-export also added five models absent from the Mar 24 one: `ESDALC6V1-1U2`, `ESDA7P60-1U1M`, `PTS636_SK25F_SMTR_LFS`, `39281083--3DModel-STEP-390490`, `436500227--3DModel-STEP-455599`. Mesh count and bbox will legitimately change. Task 1's guards must distinguish *expected* change from *drift*.

## File Structure

| File | Responsibility |
|---|---|
| `tests/board-geometry-invariants.test.ts` | **Create.** Characterization guard: per-board mesh counts and bounds, and the outline-center invariant tours depend on. |
| `tools/build-board-vrml.mjs` | **Create.** Restored + generalized VRML→bundle converter, parameterized per board (replaces the brick-only deleted tool). |
| `assets-src/board-geometry/control/` | **Create.** Vendored control WRL + `shapes3D/`, mirroring the existing `brick-buck/` layout. |
| `assets-src/board-geometry/board-model-data.js` | **Modify.** `PCB_GEO_CTRL` block regenerated. |
| `public/portfolio/assets/viewers/geometry/control.pcbgeo` | **Regenerate** via `build:geometry`. |
| `public/portfolio/assets/viewers/tours/control.tour.json` | **Regenerate** via `build:tour control`. |
| `tests/board-tour-sync.test.ts` | **Modify.** Its hardcoded control half-extents go stale when bounds change. |
| `package.json` | **Modify.** Re-add `three` devDependency; add `build:vrml` script. |

---

### Task 1: Lock coordinate-space invariants before touching anything

Pure test addition against currently-committed artifacts. Zero risk, and it is what makes every later task's breakage loud.

**Files:**
- Create: `tests/board-geometry-invariants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `readBundleBoards(): Map<string, {meshes: {color: number[], v: number[], i: number[]}[]}>` — exported from the test file for reuse in Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/board-geometry-invariants.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const bundlePath = path.join(root, "assets-src/board-geometry/board-model-data.js");

const MARKERS = [
  ["power", "const PCB_GEO = "],
  ["control", "const PCB_GEO_CTRL = "],
  ["brick", "const PCB_GEO_BRICK = "],
] as const;

interface Mesh { color: number[]; v: number[]; i: number[] }
interface Board { meshes: Mesh[] }

export function readBundleBoards(): Map<string, Board> {
  const source = readFileSync(bundlePath, "utf8");
  const starts = MARKERS.map(([name, marker]) => {
    const at = source.indexOf(marker);
    if (at === -1) throw new Error(`Missing marker ${marker}`);
    return { name, start: at + marker.length, markerAt: at };
  });

  const out = new Map<string, Board>();
  starts.forEach((entry, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].markerAt : source.length;
    const raw = source.slice(entry.start, end).trim().replace(/;$/, "");
    out.set(entry.name, JSON.parse(raw) as Board);
  });
  return out;
}

function bounds(board: Board) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of board.meshes) {
    for (let i = 0; i < mesh.v.length; i += 1) {
      const axis = i % 3;
      const value = mesh.v[i];
      if (value < lo[axis]) lo[axis] = value;
      if (value > hi[axis]) hi[axis] = value;
    }
  }
  return { lo, hi, center: lo.map((v, i) => (v + hi[i]) / 2) };
}

/**
 * The viewer recenters on the full mesh bbox (board-viewer-shell.html), while
 * tour stops are generated against the board OUTLINE centre. They only agree
 * while the mesh bbox centre stays near the origin in X and Y. Drift here is
 * invisible in the viewer and fatal to the cinematic, so it is asserted
 * directly rather than left to a visual check.
 */
const MAX_XY_CENTRE_OFFSET_MM = 1.5;

describe("board geometry bundle", () => {
  const boards = readBundleBoards();

  it.each([
    ["power", 30],
    ["control", 22],
    ["brick", 40],
  ])("%s has the expected mesh count", (name, count) => {
    expect(boards.get(name)!.meshes.length).toBe(count);
  });

  it.each(["power", "control", "brick"])("%s stays centred in X and Y", (name) => {
    const { center } = bounds(boards.get(name)!);
    expect(Math.abs(center[0])).toBeLessThan(MAX_XY_CENTRE_OFFSET_MM);
    expect(Math.abs(center[1])).toBeLessThan(MAX_XY_CENTRE_OFFSET_MM);
  });

  it("control keeps its measured bounds", () => {
    const { lo, hi } = bounds(boards.get("control")!);
    expect(lo.map((v) => Math.round(v * 100) / 100)).toEqual([-31, -37.25, -4.3]);
    expect(hi.map((v) => Math.round(v * 100) / 100)).toEqual([32.28, 37.25, 13.6]);
  });

  it("every mesh has a triangle-aligned index buffer", () => {
    for (const [name, board] of boards) {
      for (const mesh of board.meshes) {
        expect(mesh.i.length % 3, `${name} mesh index count`).toBe(0);
        expect(mesh.v.length % 3, `${name} mesh vertex count`).toBe(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it passes against today's artifacts**

Run: `npx pnpm@10.17.1 test -- board-geometry-invariants`
Expected: PASS. These are characterization tests — they must pass *now*. A failure here means the measured facts above are wrong and the plan needs revisiting before going further.

- [ ] **Step 3: Commit**

```bash
git add tests/board-geometry-invariants.test.ts
git commit -m "test: characterize board geometry bounds and centring invariants"
```

---

### Task 2: Restore the converter and prove it reproduces the brick bundle — GATE

This task decides whether the rest of the plan is possible. If the restored tool cannot reproduce the committed `PCB_GEO_BRICK`, it is not the provenance of the shipped data, and regenerating control with it would replace known-good geometry with unverifiable geometry. **Stop and report rather than proceeding on a near-miss.**

**Files:**
- Create: `tools/build-board-vrml.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tests/board-geometry-invariants.test.ts` → `readBundleBoards()`.
- Produces: `tools/build-board-vrml.mjs` accepting `node tools/build-board-vrml.mjs <asset> [--dry-run]` where `<asset>` is `brick` or `control`; `--dry-run` prints stats and writes nothing.

- [ ] **Step 1: Re-add the three devDependency**

```bash
npx pnpm@10.17.1 add -D three@0.169.0
```

Verify it landed in `devDependencies`, not `dependencies`:

```bash
node -e "const p=require('./package.json');console.log('dev:',!!p.devDependencies?.three,'prod:',!!p.dependencies?.three)"
```
Expected: `dev: true prod: false`

- [ ] **Step 2: Restore the deleted tool as a parameterized one**

Recover the original for reference, then write the generalized version:

```bash
git show 1fe4ee0^:tools/build-brick-geometry.mjs > /tmp/build-brick-geometry.mjs
```

Create `tools/build-board-vrml.mjs`. It is the recovered tool with three changes: a per-board config table replacing the hardcoded brick paths, `scale` and `colorRemap` moved into that table, and a `--dry-run` flag.

```js
/**
 * Flattens a KiCad VRML export (resolving Inline children) and converts it into
 * the `const PCB_GEO… = ` block that board-model-data.js holds for one board.
 *
 * Restored from tools/build-brick-geometry.mjs, deleted in 1fe4ee0, and
 * generalized to take a board key. The `scale` per board is NOT cosmetic: the
 * committed brick bundle is 2.54x its tracked .wrl (a 0.1-inch-unit export),
 * while the original constant was 1000 (a metre-unit export). Confirm a board's
 * scale by reproducing its committed block before trusting a new one.
 *
 *   node tools/build-board-vrml.mjs brick --dry-run
 */
import fs from "node:fs/promises";
import path from "node:path";

import { BufferGeometry, Matrix4 } from "three";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const bundlePath = path.join(rootDir, "assets-src/board-geometry/board-model-data.js");

const REFERENCE_COLORS = {
  boardMask: [0.078, 0.2, 0.141],
  darkBody: [0.148, 0.145, 0.145],
  darkBodyAlt: [0.251, 0.251, 0.251],
};

const SHARED_COLOR_REMAP = new Map([
  ["0.007,0.033,0.018", REFERENCE_COLORS.boardMask],
  ["0,0.216,0", REFERENCE_COLORS.boardMask],
  ["0.019,0.018,0.018", REFERENCE_COLORS.darkBody],
  ["0.027,0.027,0.027", REFERENCE_COLORS.darkBody],
  ["0.051,0.051,0.051", REFERENCE_COLORS.darkBody],
  ["0.061,0.061,0.061", REFERENCE_COLORS.darkBody],
  ["0.102,0.102,0.102", REFERENCE_COLORS.darkBodyAlt],
  ["0.1098,0.1098,0.1098", REFERENCE_COLORS.darkBodyAlt],
  ["0.133,0.133,0.133", REFERENCE_COLORS.darkBodyAlt],
  ["0.156,0.156,0.156", REFERENCE_COLORS.darkBodyAlt],
]);

const BOARDS = {
  brick: {
    marker: "const PCB_GEO_BRICK = ",
    dir: path.join(rootDir, "assets-src/board-geometry/brick-buck"),
    source: "brick-buck-board.wrl",
    flattened: "brick-buck-board-flattened.wrl",
    prefix: "brick_buck",
    scale: 2.54,
    colorRemap: SHARED_COLOR_REMAP,
  },
  control: {
    marker: "const PCB_GEO_CTRL = ",
    dir: path.join(rootDir, "assets-src/board-geometry/control"),
    source: "control-board.wrl",
    flattened: "control-board-flattened.wrl",
    prefix: "control_board",
    scale: 2.54,
    colorRemap: SHARED_COLOR_REMAP,
  },
};

const headerPattern = /^﻿?#VRML[^\n]*\n?/;
const defPattern = /\bDEF\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const defOrUsePattern = /\b(DEF|USE)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const inlinePattern = /Inline\s*\{\s*url\s+(?:\[\s*)?"([^"]+)"(?:\s+"[^"]+")*(?:\s*\])?\s*\}/g;
const trailingDotNumberPattern = /(?<![A-Za-z0-9_])(-?\d+)\.(?=(?:\s|,|\]|\}|$))/g;

function namespaceVrml(source, prefix) {
  const nameMap = new Map();
  for (const match of source.matchAll(defPattern)) {
    if (!nameMap.has(match[1])) nameMap.set(match[1], `${prefix}_${match[1]}`);
  }
  return source.replace(defOrUsePattern, (full, keyword, name) => {
    const renamed = nameMap.get(name);
    return renamed ? `${keyword} ${renamed}` : full;
  });
}

async function flattenFile(filePath, prefix) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);

  let source = await fs.readFile(absolutePath, "utf8");
  source = source.replace(headerPattern, "").trim();
  source = source.replace(trailingDotNumberPattern, "$1.0");
  source = namespaceVrml(source, prefix);

  let result = "";
  let lastIndex = 0;
  let childIndex = 0;

  for (const match of source.matchAll(inlinePattern)) {
    const childPath = path.resolve(directory, match[1]);
    const childContent = await flattenFile(childPath, `${prefix}_inline${++childIndex}`);
    result += source.slice(lastIndex, match.index);
    result += `\n${childContent}\n`;
    lastIndex = match.index + match[0].length;
  }

  result += source.slice(lastIndex);
  return result.trim();
}

const roundNumber = (value) => Number(value.toFixed(4));
const roundColor = (value) => Number(value.toFixed(3));

function materialColorToTuple(material, colorRemap) {
  const color = material?.color;
  if (!color) return [0.7, 0.7, 0.7];
  const tuple = [roundColor(color.r), roundColor(color.g), roundColor(color.b)];
  return colorRemap.get(tuple.join(",")) ?? tuple;
}

function appendGeometry(target, positions, normals, indices, color, scale) {
  const key = color.join(",");
  let entry = target.get(key);
  if (!entry) {
    entry = { color, v: [], n: [], i: [] };
    target.set(key, entry);
  }
  const vertexOffset = entry.v.length / 3;
  for (const value of positions) entry.v.push(roundNumber(value * scale));
  for (const value of normals) entry.n.push(roundNumber(value));
  for (const index of indices) entry.i.push(index + vertexOffset);
}

function copyIndexedSlice(indexArray, start, count) {
  const slice = new Array(count);
  for (let i = 0; i < count; i += 1) slice[i] = indexArray[start + i];
  return slice;
}

function createSequentialIndices(vertexCount) {
  const indices = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) indices[i] = i;
  return indices;
}

function extractGeometryEntries(scene, board) {
  const meshMap = new Map();
  const worldMatrix = new Matrix4();

  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;

    const geometry = new BufferGeometry();
    geometry.copy(node.geometry);
    worldMatrix.copy(node.matrixWorld);
    geometry.applyMatrix4(worldMatrix);

    const merged = mergeVertices(geometry, 1e-5);
    const position = merged.getAttribute("position");
    if (!position) return;
    const normal = merged.getAttribute("normal");

    const positions = Array.from(position.array);
    const normals = normal ? Array.from(normal.array) : new Array(position.count * 3).fill(0);
    const indexed = merged.index ? Array.from(merged.index.array) : createSequentialIndices(position.count);
    const materials = Array.isArray(node.material) ? node.material : [node.material];

    if (Array.isArray(node.material) && merged.groups.length > 0 && merged.index) {
      for (const group of merged.groups) {
        const material = materials[group.materialIndex] ?? materials[0];
        appendGeometry(
          meshMap,
          positions,
          normals,
          copyIndexedSlice(indexed, group.start, group.count),
          materialColorToTuple(material, board.colorRemap),
          board.scale,
        );
      }
      return;
    }

    appendGeometry(
      meshMap,
      positions,
      normals,
      indexed,
      materialColorToTuple(materials[0], board.colorRemap),
      board.scale,
    );
  });

  return { meshes: Array.from(meshMap.values()) };
}

async function buildPayload(board) {
  const flattenedPath = path.join(board.dir, board.flattened);
  const flattened = await flattenFile(path.join(board.dir, board.source), board.prefix);
  await fs.writeFile(flattenedPath, `#VRML V2.0 utf8\n${flattened}\n`, "utf8");
  const loader = new VRMLLoader();
  return extractGeometryEntries(loader.parse(await fs.readFile(flattenedPath, "utf8"), ""), board);
}

function describe(payload) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of payload.meshes) {
    for (let i = 0; i < mesh.v.length; i += 1) {
      const axis = i % 3;
      if (mesh.v[i] < lo[axis]) lo[axis] = mesh.v[i];
      if (mesh.v[i] > hi[axis]) hi[axis] = mesh.v[i];
    }
  }
  const fixed = (values) => values.map((v) => v.toFixed(2)).join(" .. ");
  return `${payload.meshes.length} meshes  X ${fixed([lo[0], hi[0]])}  Y ${fixed([lo[1], hi[1]])}  Z ${fixed([lo[2], hi[2]])}  centre ${((lo[0] + hi[0]) / 2).toFixed(3)}, ${((lo[1] + hi[1]) / 2).toFixed(3)}`;
}

const [assetArg, ...flags] = process.argv.slice(2);
const board = BOARDS[assetArg];
if (!board) {
  throw new Error(`Usage: node tools/build-board-vrml.mjs <${Object.keys(BOARDS).join("|")}> [--dry-run]`);
}

const payload = await buildPayload(board);
console.log(`${assetArg}: ${describe(payload)}`);

if (flags.includes("--dry-run")) {
  console.log("--dry-run: bundle not written");
} else {
  const source = await fs.readFile(bundlePath, "utf8");
  const marker = board.marker;
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`Missing marker ${marker} in ${bundlePath}`);
  const nextMarkers = Object.values(BOARDS)
    .map((b) => source.indexOf(b.marker, at + marker.length))
    .filter((index) => index !== -1);
  const end = nextMarkers.length ? Math.min(...nextMarkers) : source.length;
  const next = `${source.slice(0, at)}${marker}${JSON.stringify(payload)};\n${source.slice(end)}`;
  await fs.writeFile(bundlePath, next, "utf8");
  console.log(`Wrote ${marker.trim()} to ${bundlePath}`);
  console.log("Run `npx pnpm@10.17.1 build:geometry` to regenerate the viewer binaries.");
}
```

Add the script to `package.json`:

```json
"build:vrml": "node --max-old-space-size=6144 tools/build-board-vrml.mjs",
```

- [ ] **Step 3: Run the brick reproduction gate**

```bash
node --max-old-space-size=6144 tools/build-board-vrml.mjs brick --dry-run
```

Expected output, matching the committed bundle from Task 1:
```
brick: 40 meshes  X -79.40 .. 78.59  Y -79.70 .. 78.95  Z -16.20 .. 16.80  centre -0.405, -0.375
```

- [ ] **Step 4: Judge the gate**

- **Mesh count 40 and all three axis ranges within ±0.05 mm** → the tool is faithful. Proceed to Task 3.
- **Ranges off by a constant factor** → wrong `scale`. Try `1000`, re-run, re-judge. Only these two values are plausible; a third means the tracked WRL is not the bundle's source.
- **Mesh count differs, or ranges differ non-uniformly** → **STOP.** The tracked WRL is not the provenance of the shipped brick bundle. Report this and do not touch `control`. Regenerating from an unverified tool would trade known-good geometry for unverifiable geometry.

- [ ] **Step 5: Commit (only if the gate passed)**

```bash
git add tools/build-board-vrml.mjs package.json pnpm-lock.yaml
git commit -m "build: restore VRML to bundle converter, parameterized per board"
```

---

### Task 3: Re-export the control board with a board-centred origin and vendor it

**Files:**
- Create: `assets-src/board-geometry/control/control-board.wrl`
- Create: `assets-src/board-geometry/control/shapes3D/*.wrl`

**Interfaces:**
- Consumes: `tools/build-board-vrml.mjs` `BOARDS.control` paths from Task 2.
- Produces: a control WRL tree whose X/Y bbox centre is `0.0000, 0.0000` in VRML units.

- [ ] **Step 1: Re-export from KiCad with the correct origin**

This step is manual, in KiCad, on `Control Board POC.kicad_pcb`.

1. Move the U2 model out of `~/Downloads` first — that path is volatile. Copy `TLV76733DRVR.STEP` into the project's 3D library folder and repoint U2's `(model …)` at it via a path variable rather than an absolute path.
2. `File > Export > VRML`.
3. **Set "Coordinate origin" to Board centre.** This is the whole point of the task — the Sep 20 export used a different origin and is offset by 9.00 mm, 4.75 mm.
4. Export units must match the Mar 24 export (0.1 inch per unit, giving a board Z span of `0.6890`).
5. Keep "copy 3D model files" enabled so `shapes3D/` is written alongside.

- [ ] **Step 2: Verify the export origin before vendoring it**

```bash
python3 - <<'PY'
import re
p = "/Users/cameron/Documents/Paradigm PCB's/Control Board POC/Aux Control Board/3D Viewer files/Control Board.wrl"
s = open(p, errors="replace").read()
xs, ys, zs = [], [], []
for blk in re.findall(r"point\s*\[(.*?)\]", s, re.S):
    for a, b, c in re.findall(r"(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)", blk):
        try: xs.append(float(a)); ys.append(float(b)); zs.append(float(c))
        except ValueError: pass
print(f"X centre {(min(xs)+max(xs))/2:.4f}  Y centre {(min(ys)+max(ys))/2:.4f}")
print(f"X span {max(xs)-min(xs):.4f}  Y span {max(ys)-min(ys):.4f}  Z span {max(zs)-min(zs):.4f}")
PY
```

Expected:
```
X centre 0.0000  Y centre 0.0000
X span 24.4094  Y span 29.3307  Z span 0.6890
```

If the centre is not `0.0000, 0.0000`, the origin setting did not take. Go back to Step 1. Do not vendor an off-centre export — Task 1's centring test will catch it later, but fixing it here costs one re-export instead of a revert.

- [ ] **Step 3: Vendor the tree into the repo**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
SRC="/Users/cameron/Documents/Paradigm PCB's/Control Board POC/Aux Control Board/3D Viewer files"
mkdir -p assets-src/board-geometry/control
cp "$SRC/Control Board.wrl" assets-src/board-geometry/control/control-board.wrl
cp -R "$SRC/shapes3D" assets-src/board-geometry/control/shapes3D
```

Confirm U2 arrived and the Inline references resolve relative to the new location:

```bash
ls assets-src/board-geometry/control/shapes3D/TLV76733DRVR.wrl
grep -c 'Inline' assets-src/board-geometry/control/control-board.wrl
```
Expected: the file lists, and the Inline count is `62`.

- [ ] **Step 4: Commit**

```bash
git add assets-src/board-geometry/control/
git commit -m "assets: vendor board-centred control board VRML export with U2 model"
```

---

### Task 4: Regenerate `PCB_GEO_CTRL` and update the invariant baselines

**Files:**
- Modify: `assets-src/board-geometry/board-model-data.js`
- Modify: `tests/board-geometry-invariants.test.ts`

**Interfaces:**
- Consumes: `tools/build-board-vrml.mjs` (Task 2), `assets-src/board-geometry/control/` (Task 3).
- Produces: a regenerated `PCB_GEO_CTRL` block whose X/Y centre is within `MAX_XY_CENTRE_OFFSET_MM` of the origin.

- [ ] **Step 1: Dry-run the control conversion**

```bash
node --max-old-space-size=6144 tools/build-board-vrml.mjs control --dry-run
```

Read the printed `centre` values. Both must be under 1.5 mm. Mesh count and bounds will legitimately differ from the committed 22 meshes / `−31.00 .. 32.28` — Measured Fact 6 lists five newly-modelled parts, and U2 itself adds geometry. **Record the printed numbers**; Step 4 writes them into the test.

If `centre` exceeds 1.5 mm in X or Y, the export origin is still wrong. Return to Task 3 Step 1.

- [ ] **Step 2: Write the bundle**

```bash
node --max-old-space-size=6144 tools/build-board-vrml.mjs control
```

- [ ] **Step 3: Run the invariant tests and watch them fail on the stale baseline**

Run: `npx pnpm@10.17.1 test -- board-geometry-invariants`
Expected: FAIL on `control has the expected mesh count` and `control keeps its measured bounds`. The centring test must still PASS — if centring fails, the export origin is wrong and Step 1's check was misread.

- [ ] **Step 4: Update the baselines to the newly measured values**

In `tests/board-geometry-invariants.test.ts`, replace the control mesh count in the `it.each` table and the two arrays in `control keeps its measured bounds` with the numbers printed in Step 1. Leave `power` and `brick` untouched — if either moved, something is wrong beyond this task's scope.

- [ ] **Step 5: Run the full unit suite**

Run: `npx pnpm@10.17.1 test`
Expected: PASS, except `board-tour-sync.test.ts`, which may fail on its hardcoded control half-extents. Task 5 fixes that; if it fails here, note the values and continue.

- [ ] **Step 6: Commit**

```bash
git add assets-src/board-geometry/board-model-data.js tests/board-geometry-invariants.test.ts
git commit -m "feat: regenerate control board geometry with U2 LDO model"
```

---

### Task 5: Regenerate the viewer binary and the tour, and realign their guards

**Files:**
- Modify: `public/portfolio/assets/viewers/geometry/control.pcbgeo`
- Modify: `public/portfolio/assets/viewers/tours/control.tour.json`
- Modify: `tests/board-tour-sync.test.ts`

**Interfaces:**
- Consumes: the regenerated `PCB_GEO_CTRL` from Task 4.
- Produces: `control.pcbgeo` and `control.tour.json` consistent with each other and with the new bundle.

- [ ] **Step 1: Regenerate the per-board binaries**

```bash
npx pnpm@10.17.1 build:geometry
```

Expected: a `control` line whose `max error` is well under 5.00 um. `build-board-geometry-bin.mjs` throws above `MAX_ROUND_TRIP_ERROR_MM = 0.005`, so a pass here also proves the new geometry quantizes cleanly.

- [ ] **Step 2: Regenerate the control tour**

```bash
npx pnpm@10.17.1 build:tour control
```

- [ ] **Step 3: Diff the tour stops against the committed version**

```bash
git diff public/portfolio/assets/viewers/tours/control.tour.json
```

Expected: `x`, `y` and `span` shift by well under 1 mm. The tour is generated from the Interactive BOM, not from the geometry, so a *large* shift here means the board outline centre moved — which would mean the export origin is wrong despite Task 3 Step 2 passing. Investigate before continuing; do not accept a multi-millimetre shift.

Pay particular attention to the `ldo` stop: it is U2, `span` 3.512 mm, and the one this whole plan exists to show.

- [ ] **Step 4: Update the tour-sync half-extents**

`tests/board-tour-sync.test.ts` hardcodes control's measured bounds in its comment and its half-extent table. Update both to the values Task 4 Step 1 printed, keeping the comment's stated numbers in sync with the code — the comment is the only record of where they came from.

- [ ] **Step 5: Run the full gate**

```bash
npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add public/portfolio/assets/viewers/geometry/control.pcbgeo \
        public/portfolio/assets/viewers/tours/control.tour.json \
        tests/board-tour-sync.test.ts
git commit -m "build: regenerate control board viewer binary and guided tour"
```

---

### Task 6: Verify the viewer and the cinematic in a real browser

Automated gates cannot see a misaimed camera or a part rendered inside the board. This task is the visual check, and it is not optional — Measured Fact 2 describes a failure mode that is invisible to every test above.

**Files:**
- No source changes expected. Any fix discovered here reopens Task 3 or 4.

**Interfaces:**
- Consumes: the regenerated artifacts from Task 5.

- [ ] **Step 1: Run the e2e suite against the production bundle**

```bash
npx pnpm@10.17.1 e2e:preview
```
Expected: PASS. This is the same run that gates the Pages deploy, so a failure here would have blocked release.

- [ ] **Step 2: Inspect the control board viewer by hand**

Start the dev server, open the control board project, and confirm:
- U2 is present, sits flush on the board (not floating, not sunk), and is oriented like its neighbours.
- The board is centred in the canvas and does not sit off to one side — an off-centre board means the mesh bbox and outline centres have desynced.
- No component has moved relative to the silkscreen.

- [ ] **Step 3: Watch the cinematic end to end**

Let the homepage showcase run a full loop. For the control board, confirm all four stops — `mcu`, `ldo`, `can`, `level-shift` — frame their part. `ldo` is the critical one: it is U2 at `span` 3.512 mm, the tightest stop on the board, and the first that a coordinate shift would miss.

Measure during real playback, not via `__applyTour`. A synthetic drive positions the label before the rAF that refreshes `mountWidth`, so labels project against stale canvas dimensions and read as off-screen when they are not.

- [ ] **Step 4: Commit any fixes, then open the PR**

If Steps 2 or 3 found a problem, fix it at its source — an orientation problem is KiCad-side (Task 3), a framing problem is coordinate-side (Task 4) — and re-run this task. Once clean:

```bash
git push -u origin HEAD
```

Open the PR summarizing: U2 added, control geometry regenerated from a board-centred export, converter restored and gated on brick reproduction, invariant tests added.

---

## Rollback

Every artifact this plan touches is committed, so recovery is `git revert` of the Task 4 and Task 5 commits, which restores the previous `PCB_GEO_CTRL`, `control.pcbgeo` and `control.tour.json` together. Keep them as separate commits for exactly this reason — reverting geometry without reverting the tour would leave the cinematic aimed at coordinates that no longer exist.

## Self-Review Notes

- **Spec coverage:** Measured Facts 1-6 each map to a task — 1 and 3 to Task 3's origin check, 2 to Task 1's centring test and Task 6 Step 3, 3 to Task 2's gate, 4 to Task 1's baselines, 5 to Task 6 Step 2, 6 to Task 4 Step 1's expectation that counts change.
- **Placeholders:** none. The one genuinely unknown value (control's post-regeneration mesh count and bounds) is measured in Task 4 Step 1 and written into the test in Step 4, rather than guessed here.
- **Type consistency:** `readBundleBoards()` is defined in Task 1 and referenced by name in Task 2's Interfaces. `BOARDS` keys (`brick`, `control`) match the CLI argument in Tasks 2, 4 and the `asset` names in `build-board-geometry-bin.mjs`.
- **Known open question:** Task 2 Step 4 may reveal `scale: 2.54` is wrong. That is why it is a gate with an explicit stop condition rather than an assumption baked into later tasks.
