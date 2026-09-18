import { describe, expect, it } from "vitest";

import { SPIN_START_THETA, scrollProgress, spinPose } from "../src/app/src/app/lib/board-spin";

describe("scrollProgress", () => {
  it("is 0 when the block's top sits at the bottom edge of the viewport", () => {
    expect(scrollProgress(800, 400, 800)).toBe(0);
  });

  it("is 1 when the block's bottom sits at the top edge of the viewport", () => {
    expect(scrollProgress(-400, 400, 800)).toBe(1);
  });

  it("is 0.5 when the block is centred in the viewport", () => {
    expect(scrollProgress(200, 400, 800)).toBeCloseTo(0.5, 5);
  });

  it("clamps outside the travel window instead of running past one revolution", () => {
    expect(scrollProgress(5000, 400, 800)).toBe(0);
    expect(scrollProgress(-5000, 400, 800)).toBe(1);
  });

  it("returns the midpoint rather than dividing by zero on a zero-height viewport", () => {
    expect(scrollProgress(0, 0, 0)).toBe(0.5);
  });
});

describe("spinPose", () => {
  it("starts at the shell's default heading", () => {
    expect(spinPose(0).theta).toBeCloseTo(SPIN_START_THETA, 5);
  });

  it("completes exactly one revolution across the travel window", () => {
    expect(spinPose(1).theta - spinPose(0).theta).toBeCloseTo(Math.PI * 2, 5);
  });

  it("dives low and close at the midpoint and sits high and wide at both edges", () => {
    const start = spinPose(0);
    const middle = spinPose(0.5);
    const end = spinPose(1);

    expect(middle.phi).toBeLessThan(start.phi);
    expect(middle.radiusScale).toBeLessThan(start.radiusScale);
    expect(end.phi).toBeCloseTo(start.phi, 5);
    expect(end.radiusScale).toBeCloseTo(start.radiusScale, 5);
  });

  it("keeps phi inside the shell's own polar clamp so the camera never flips", () => {
    for (let step = 0; step <= 20; step += 1) {
      const pose = spinPose(step / 20);
      expect(pose.phi).toBeGreaterThan(0.04);
      expect(pose.phi).toBeLessThan(Math.PI - 0.04);
    }
  });

  it("clamps out-of-range progress to the ends of the travel window", () => {
    expect(spinPose(-3).theta).toBeCloseTo(spinPose(0).theta, 5);
    expect(spinPose(3).theta).toBeCloseTo(spinPose(1).theta, 5);
  });
});
