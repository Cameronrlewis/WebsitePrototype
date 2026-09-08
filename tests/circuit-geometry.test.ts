import { describe, expect, it } from "vitest";

import { computeGaps, placeCenterpieces } from "../src/app/src/app/lib/circuit-geometry";

/** Six stacked sections with a uniform gap between them, matching the shape
 *  Layout renders: space-y-16 lg:space-y-24 gives 96px on desktop. */
function sectionsWithGap(gapPx: number) {
  const sectionHeight = 800;
  return Array.from({ length: 6 }, (_, index) => ({
    top: index * (sectionHeight + gapPx),
    height: sectionHeight,
  }));
}

describe("circuit geometry placement", () => {
  it("produces one fewer gap than the number of sections", () => {
    expect(computeGaps(sectionsWithGap(96))).toHaveLength(5);
  });

  it("places one centerpiece per usable gap at the desktop gap of 96px", () => {
    const placed = placeCenterpieces(computeGaps(sectionsWithGap(96)), 900);
    // Six stacked sections yield FIVE inter-section gaps, and the queue drops
    // one block per gap - so the sixth queue entry (timer555) never places.
    // This is by design, not a defect.
    expect(placed).toHaveLength(5);
    expect(placed.map((piece) => piece.kind)).toEqual(["rectifier", "buck", "ldo", "mcu", "fpga"]);
  });

  it("places nothing when the gap falls below the 70px threshold", () => {
    // The documented silent failure: tighten the section spacing and every IC
    // disappears with no error. Keep this red rather than "fixing" it quietly.
    expect(placeCenterpieces(computeGaps(sectionsWithGap(60)), 900)).toHaveLength(0);
  });

  it("drops the buck block when horizontal room is under 340px", () => {
    // Full six-block queue (span 900), but only 300px of room per gap: the
    // rectifier fits at 300, the buck does not and blocks the queue behind it.
    const placed = placeCenterpieces(computeGaps(sectionsWithGap(96)), 300, 900);
    expect(placed.some((piece) => piece.kind === "buck")).toBe(false);
    expect(placed.map((piece) => piece.kind)).toEqual(["rectifier"]);
  });
});
