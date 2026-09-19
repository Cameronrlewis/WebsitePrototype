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

  it("follows relpos and angle instead of assuming the origin is the centre", () => {
    // J11 on the brick board, verbatim from its IBOM. Its origin sits well
    // outside its own bounding box, so `pos` alone aims 13mm off the part.
    const j11 = {
      ref: "J11",
      bbox: { pos: [66.75, 42.005], relpos: [-3.075, -8.255], size: [31.16, 26.51], angle: 90 },
    };

    expect(stopCenter(["J11"], [j11])).toEqual({ pos: [71.75, 29.5], span: 31.16 });
  });

  it("throws on a ref that is not on the board, rather than silently skipping it", () => {
    expect(() => stopCenter(["U99"], footprints)).toThrow(/U99/);
  });
});
