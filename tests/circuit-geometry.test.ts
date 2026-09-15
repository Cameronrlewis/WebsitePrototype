import { describe, expect, it } from "vitest";

import { buildTrace, computeGaps, placeCenterpieces, type CenterpieceKind } from "../src/app/src/app/lib/circuit-geometry";

/** Six stacked sections with a uniform gap between them, matching the shape
 *  Layout renders: space-y-16 lg:space-y-24 gives 96px on desktop. */
function sectionsWithGap(gapPx: number) {
  const sectionHeight = 800;
  return Array.from({ length: 6 }, (_, index) => ({
    top: index * (sectionHeight + gapPx),
    height: sectionHeight,
  }));
}

/** Page height tall enough to hold sectionsWithGap(gapPx) plus a trailing
 *  run to the ground bus, matching how CircuitTrace measures scrollHeight. */
function pageHeight(gapPx: number) {
  const sections = sectionsWithGap(gapPx);
  const last = sections[sections.length - 1];
  return last.top + last.height + 200;
}

const CENTERPIECE_KINDS: CenterpieceKind[] = ["rectifier", "buck", "ldo", "mcu", "fpga", "timer555"];

function centerpieceKindsIn(geometry: ReturnType<typeof buildTrace>) {
  return geometry.components.filter((c) => (CENTERPIECE_KINDS as string[]).includes(c.type)).map((c) => c.type);
}

/** True if any (x, y) vertex the path visits is non-finite. */
function pathHasBadCoords(d: string) {
  return /NaN|undefined/.test(d);
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

describe("buildTrace", () => {
  it("places all five centerpieces in power-chain order on a full-span desktop layout", () => {
    const geometry = buildTrace(1400, pageHeight(96), computeGaps(sectionsWithGap(96)));
    // Same drop as placeCenterpieces above: 5 gaps can only host 5 of the 6
    // queued blocks, so timer555 never gets a turn.
    expect(centerpieceKindsIn(geometry)).toEqual(["rectifier", "buck", "ldo", "mcu", "fpga"]);
  });

  it("drops the buck block but keeps the rectifier when the page is too narrow for the buck's 340px requirement", () => {
    // Derived empirically: at width 600 the per-gap `avail` clears the
    // rectifier's 300px minAvail but falls short of the buck's 340px, so the
    // buck (and everything queued behind it) never places.
    const geometry = buildTrace(600, pageHeight(96), computeGaps(sectionsWithGap(96)));
    expect(centerpieceKindsIn(geometry)).toEqual(["rectifier"]);
  });

  it("carries the power-rail narrative through netFlags in order: AC IN, +12V, +3V3, +1V8, GND", () => {
    const geometry = buildTrace(1400, pageHeight(96), computeGaps(sectionsWithGap(96)));
    const firstOccurrenceOrder = [...new Set(geometry.netFlags.map((flag) => flag.text))];
    expect(firstOccurrenceOrder).toEqual(["AC IN", "+12V", "+3V3", "+1V8", "GND"]);
  });

  it("never emits a NaN or undefined coordinate, in the main path, every branch path, or any component position", () => {
    for (const geometry of [
      buildTrace(1400, pageHeight(96), computeGaps(sectionsWithGap(96))),
      buildTrace(500, pageHeight(96), computeGaps(sectionsWithGap(96))),
      buildTrace(1400, pageHeight(0), computeGaps(sectionsWithGap(0))),
    ]) {
      expect(pathHasBadCoords(geometry.path)).toBe(false);
      for (const branch of geometry.branches) {
        expect(pathHasBadCoords(branch.path)).toBe(false);
      }
      for (const component of geometry.components) {
        expect(Number.isFinite(component.x)).toBe(true);
        expect(Number.isFinite(component.y)).toBe(true);
      }
    }
  });

  it("never routes an ambient decoration path through the readout's keep-out box", () => {
    const geometry = buildTrace(1400, pageHeight(96), computeGaps(sectionsWithGap(96)));
    expect(geometry.display).not.toBeNull();
    const d = geometry.display as { x: number; y: number };
    // Same padding buildTrace itself applies around the readout before laying
    // ambient decoration (display obstacle box in the ambient-network pass).
    const box = { x1: d.x - 12, y1: d.y - 12, x2: d.x + 130, y2: d.y + 55 };
    for (const path of geometry.ambientPaths) {
      const coords = path.match(/-?\d+\.?\d*/g)!.map(Number);
      for (let i = 0; i < coords.length; i += 2) {
        const [x, y] = [coords[i], coords[i + 1]];
        const inBox = x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
        expect(inBox).toBe(false);
      }
    }
  });

  it("returns a valid geometry instead of throwing when every gap is below the placement threshold", () => {
    // All-zero gaps: usableGaps filters every one out, so no centerpiece ever
    // places, but the bus still has to wander to the ground rail and return
    // a well-formed TraceGeometry.
    const geometry = buildTrace(1400, pageHeight(0), computeGaps(sectionsWithGap(0)));
    expect(centerpieceKindsIn(geometry)).toEqual([]);
    expect(Array.isArray(geometry.components)).toBe(true);
    expect(Array.isArray(geometry.branches)).toBe(true);
    expect(Array.isArray(geometry.ambientPaths)).toBe(true);
    expect(Number.isFinite(geometry.totalLength)).toBe(true);
    expect(geometry.totalLength).toBeGreaterThan(0);
  });
});
