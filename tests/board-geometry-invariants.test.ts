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
