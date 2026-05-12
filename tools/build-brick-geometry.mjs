import fs from "node:fs/promises";
import path from "node:path";

import { BufferGeometry, Matrix4 } from "three";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const viewerDir = path.join(rootDir, "public/portfolio/assets/viewers/brick-buck");
const sourceWrlPath = path.join(viewerDir, "brick-buck-board.wrl");
const flattenedWrlPath = path.join(viewerDir, "brick-buck-board-flattened.wrl");
const bundlePath = path.join(rootDir, "public/portfolio/assets/scripts/viewer/board-model-data.js");

const headerPattern = /^\uFEFF?#VRML[^\n]*\n?/;
const defPattern = /\bDEF\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const defOrUsePattern = /\b(DEF|USE)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const inlinePattern = /Inline\s*\{\s*url\s+(?:\[\s*)?"([^"]+)"(?:\s+"[^"]+")*(?:\s*\])?\s*\}/g;
const trailingDotNumberPattern = /(?<![A-Za-z0-9_])(-?\d+)\.(?=(?:\s|,|\]|\}|$))/g;
const BRICK_BUNDLE_SCALE = 1000;
const AUX_REFERENCE_COLORS = {
  boardMask: [0.078, 0.2, 0.141],
  darkBody: [0.148, 0.145, 0.145],
  darkBodyAlt: [0.251, 0.251, 0.251],
};

const BRICK_COLOR_REMAP = new Map([
  ["0.007,0.033,0.018", AUX_REFERENCE_COLORS.boardMask],
  ["0,0.216,0", AUX_REFERENCE_COLORS.boardMask],
  ["0.019,0.018,0.018", AUX_REFERENCE_COLORS.darkBody],
  ["0.027,0.027,0.027", AUX_REFERENCE_COLORS.darkBody],
  ["0.051,0.051,0.051", AUX_REFERENCE_COLORS.darkBody],
  ["0.061,0.061,0.061", AUX_REFERENCE_COLORS.darkBody],
  ["0.102,0.102,0.102", AUX_REFERENCE_COLORS.darkBodyAlt],
  ["0.1098,0.1098,0.1098", AUX_REFERENCE_COLORS.darkBodyAlt],
  ["0.133,0.133,0.133", AUX_REFERENCE_COLORS.darkBodyAlt],
  ["0.156,0.156,0.156", AUX_REFERENCE_COLORS.darkBodyAlt],
]);

function namespaceVrml(source, prefix) {
  const nameMap = new Map();

  for (const match of source.matchAll(defPattern)) {
    const name = match[1];
    if (!nameMap.has(name)) {
      nameMap.set(name, `${prefix}_${name}`);
    }
  }

  return source.replace(defOrUsePattern, (fullMatch, keyword, name) => {
    const renamed = nameMap.get(name);
    return renamed ? `${keyword} ${renamed}` : fullMatch;
  });
}

function normalizeVrmlNumbers(source) {
  return source.replace(trailingDotNumberPattern, "$1.0");
}

async function flattenFile(filePath, prefix) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);

  let source = await fs.readFile(absolutePath, "utf8");
  source = source.replace(headerPattern, "").trim();
  source = normalizeVrmlNumbers(source);
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

function roundNumber(value) {
  return Number(value.toFixed(4));
}

function roundColor(value) {
  return Number(value.toFixed(3));
}

function normalizeBrickColor(colorTuple) {
  const mapped = BRICK_COLOR_REMAP.get(colorTuple.join(","));
  if (mapped) {
    return mapped;
  }

  return colorTuple;
}

function materialColorToTuple(material) {
  const color = material?.color;
  if (!color) {
    return [0.7, 0.7, 0.7];
  }

  return normalizeBrickColor([roundColor(color.r), roundColor(color.g), roundColor(color.b)]);
}

function appendGeometry(target, positions, normals, indices, color) {
  const key = color.join(",");
  let entry = target.get(key);

  if (!entry) {
    entry = { color, v: [], n: [], i: [] };
    target.set(key, entry);
  }

  const vertexOffset = entry.v.length / 3;
  for (const value of positions) {
    entry.v.push(roundNumber(value * BRICK_BUNDLE_SCALE));
  }
  for (const value of normals) {
    entry.n.push(roundNumber(value));
  }
  for (const index of indices) {
    entry.i.push(index + vertexOffset);
  }
}

function copyIndexedSlice(indexArray, start, count) {
  const slice = new Array(count);
  for (let i = 0; i < count; i += 1) {
    slice[i] = indexArray[start + i];
  }
  return slice;
}

function createSequentialIndices(vertexCount) {
  const indices = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    indices[i] = i;
  }
  return indices;
}

function extractGeometryEntries(scene) {
  const meshMap = new Map();
  const worldMatrix = new Matrix4();

  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }

    const baseGeometry = node.geometry;
    const geometry = new BufferGeometry();
    geometry.copy(baseGeometry);

    worldMatrix.copy(node.matrixWorld);
    geometry.applyMatrix4(worldMatrix);

    const mergedGeometry = mergeVertices(geometry, 1e-5);
    const position = mergedGeometry.getAttribute("position");
    const normal = mergedGeometry.getAttribute("normal");
    if (!position) {
      return;
    }

    const positions = Array.from(position.array);
    const normals = normal ? Array.from(normal.array) : new Array(position.count * 3).fill(0);
    const indexed = mergedGeometry.index ? Array.from(mergedGeometry.index.array) : createSequentialIndices(position.count);
    const materials = Array.isArray(node.material) ? node.material : [node.material];

    if (Array.isArray(node.material) && mergedGeometry.groups.length > 0 && mergedGeometry.index) {
      for (const group of mergedGeometry.groups) {
        const material = materials[group.materialIndex] ?? materials[0];
        appendGeometry(
          meshMap,
          positions,
          normals,
          copyIndexedSlice(indexed, group.start, group.count),
          materialColorToTuple(material),
        );
      }
      return;
    }

    appendGeometry(meshMap, positions, normals, indexed, materialColorToTuple(materials[0]));
  });

  return { meshes: Array.from(meshMap.values()) };
}

async function writeFlattenedSource() {
  const flattened = await flattenFile(sourceWrlPath, "brick_buck");
  await fs.writeFile(flattenedWrlPath, `#VRML V2.0 utf8\n${flattened}\n`, "utf8");
  return flattenedWrlPath;
}

async function buildBrickGeometryPayload() {
  const loader = new VRMLLoader();
  const flattenedPath = await writeFlattenedSource();
  const vrmlSource = await fs.readFile(flattenedPath, "utf8");
  const scene = loader.parse(vrmlSource, "");
  return extractGeometryEntries(scene);
}

async function updateBundleFile(payload) {
  const source = await fs.readFile(bundlePath, "utf8");
  const nextSource = source.includes("\nconst PCB_GEO_BRICK = ")
    ? source.replace(/\nconst PCB_GEO_BRICK = [\s\S]*?;\s*$/, `\nconst PCB_GEO_BRICK = ${JSON.stringify(payload)};\n`)
    : `${source.trimEnd()}\nconst PCB_GEO_BRICK = ${JSON.stringify(payload)};\n`;

  await fs.writeFile(bundlePath, nextSource, "utf8");
}

const payload = await buildBrickGeometryPayload();
await updateBundleFile(payload);

console.log(`Brick Buck geometry bundle written to ${bundlePath}`);
