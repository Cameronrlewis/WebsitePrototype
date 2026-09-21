import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const bundlePath = path.join(root, "assets-src/board-geometry/board-model-data.js");
const geometryDir = path.join(root, "public/portfolio/assets/viewers/geometry");

const MARKERS = [
  ["power", "const PCB_GEO = "],
  ["control", "const PCB_GEO_CTRL = "],
  ["brick", "const PCB_GEO_BRICK = "],
] as const;

interface Mesh { color: number[]; v: number[]; i: number[] }
interface Board { meshes: Mesh[] }

function readBundleBoards(): Map<string, Board> {
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
    ["control", 21],
    ["brick", 40],
  ] as const)("%s has the expected mesh count", (name, count) => {
    expect(boards.get(name)!.meshes.length).toBe(count);
  });

  it.each(["power", "control", "brick"] as const)("%s stays centred in X and Y", (name) => {
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

/** Mirrors encodeMesh's min/scale derivation in build-board-geometry-bin.mjs. */
function meshBounds(mesh: Mesh) {
  const vertexCount = mesh.v.length / 3;
  const min = [0, 0, 0];
  const scale = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let v = 0; v < vertexCount; v += 1) {
      const value = mesh.v[v * 3 + axis];
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
    min[axis] = lo;
    scale[axis] = hi - lo;
  }
  return { min, scale };
}

function decodePcbgeoHeader(asset: string) {
  const buf = gunzipSync(readFileSync(path.join(geometryDir, `${asset}.pcbgeo`)));
  if (buf.toString("ascii", 0, 4) !== "PCBG") throw new Error(`${asset}: bad magic`);
  const headerLength = buf.readUInt32LE(8);
  const json = buf.toString("utf8", 12, 12 + headerLength).replace(/\0+$/, "");
  return JSON.parse(json) as {
    meshes: { color: number[]; vertexCount: number; indexCount: number; min: number[]; scale: number[] }[];
  };
}

describe("shipped .pcbgeo binaries stay in sync with the bundle", () => {
  const boards = readBundleBoards();

  it.each(["power", "control", "brick"] as const)("%s binary matches its bundle block", (name) => {
    const bundle = boards.get(name)!;
    const shipped = decodePcbgeoHeader(name);

    expect(shipped.meshes.length).toBe(bundle.meshes.length);
    bundle.meshes.forEach((mesh, i) => {
      const shippedMesh = shipped.meshes[i];
      const { min, scale } = meshBounds(mesh);
      expect(shippedMesh.color).toEqual(mesh.color);
      expect(shippedMesh.vertexCount).toBe(mesh.v.length / 3);
      expect(shippedMesh.indexCount).toBe(mesh.i.length);
      shippedMesh.min.forEach((v, axis) => expect(v).toBeCloseTo(min[axis], 6));
      shippedMesh.scale.forEach((v, axis) => expect(v).toBeCloseTo(scale[axis], 6));
    });
  });
});
