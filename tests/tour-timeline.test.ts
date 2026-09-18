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
