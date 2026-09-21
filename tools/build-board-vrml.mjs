/**
 * Flattens a KiCad VRML export (resolving Inline children) and converts it into
 * the `const PCB_GEO… = ` block that board-model-data.js holds for one board.
 *
 * Restored from tools/build-brick-geometry.mjs, deleted in 1fe4ee0, and
 * generalized to take a board key. `scale` is NOT cosmetic: the deleted
 * original used 1000 (a metre-unit export), and running this tool against
 * brick with that value exactly reproduces the committed PCB_GEO_BRICK block
 * (40 meshes, all axis ranges match to 0.01mm) - so 1000 is confirmed, not
 * the 2.54 an earlier draft of this tool assumed. Confirm any other board's
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
    scale: 1000,
    colorRemap: SHARED_COLOR_REMAP,
  },
  control: {
    marker: "const PCB_GEO_CTRL = ",
    dir: path.join(rootDir, "assets-src/board-geometry/control"),
    source: "control-board.wrl",
    flattened: "control-board-flattened.wrl",
    prefix: "control_board",
    scale: 1000,
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
  // `n` is retained deliberately even though no downstream consumer reads it
  // (build-board-geometry-bin.mjs only counts it to report droppedNormals):
  // dropping it would change this converter's output and break the brick
  // byte-reproduction that validates `scale: 1000`.
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

async function buildPayload(board, { dryRun }) {
  const flattened = await flattenFile(path.join(board.dir, board.source), board.prefix);
  const flattenedVrml = `#VRML V2.0 utf8\n${flattened}\n`;

  // A dry run must not touch the *-flattened.wrl artifact (55 MB for brick),
  // so the flattened string is parsed in memory here and only written to
  // disk once we're actually about to rewrite the bundle.
  if (!dryRun) {
    await fs.writeFile(path.join(board.dir, board.flattened), flattenedVrml, "utf8");
  }

  const loader = new VRMLLoader();
  return extractGeometryEntries(loader.parse(flattenedVrml, ""), board);
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

const dryRun = flags.includes("--dry-run");
const payload = await buildPayload(board, { dryRun });
console.log(`${assetArg}: ${describe(payload)}`);

if (dryRun) {
  console.log("--dry-run: bundle not written");
} else {
  const source = await fs.readFile(bundlePath, "utf8");
  const marker = board.marker;
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`Missing marker ${marker} in ${bundlePath}`);
  // Bound the splice by the NEXT top-level `const NAME = ` block actually
  // present in the file, not by the boards this tool happens to manage - the
  // bundle also holds an unmanaged `const PCB_GEO = ` (power) block, and its
  // position in the file isn't something this tool should assume.
  const topLevelMarkerPattern = /^const \w+ = /gm;
  topLevelMarkerPattern.lastIndex = at + marker.length;
  const nextMatch = topLevelMarkerPattern.exec(source);
  const end = nextMatch ? nextMatch.index : source.length;
  const next = `${source.slice(0, at)}${marker}${JSON.stringify(payload)};\n${source.slice(end)}`;
  await fs.writeFile(bundlePath, next, "utf8");
  console.log(`Wrote ${marker.trim()} to ${bundlePath}`);
  console.log("Run `npx pnpm@10.17.1 build:geometry` to regenerate the viewer binaries.");
}
