/**
 * Camera path for the non-interactive board showcase. The viewer shell owns
 * the same curve in plain JS (it loads no modules); keep the two in step.
 */

export interface SpinPose {
  /** Azimuth in radians, matching the shell's `state.theta`. */
  theta: number;
  /** Polar angle in radians, matching the shell's `state.phi`. */
  phi: number;
  /** Multiplier on the board's max dimension, matching `state.r / maxDimension`. */
  radiusScale: number;
}

/** The shell's own `defaults.theta`, so progress 0 matches a freshly opened viewer. */
export const SPIN_START_THETA = -0.5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Maps a block's viewport rectangle to 0..1: 0 when its top edge touches the
 * bottom of the viewport, 1 when its bottom edge touches the top.
 */
export function scrollProgress(top: number, height: number, viewportHeight: number): number {
  const travel = viewportHeight + height;
  if (travel <= 0) {
    return 0.5;
  }

  return clamp01((viewportHeight - top) / travel);
}

/** One full revolution, easing low and close through the midpoint. */
export function spinPose(progress: number): SpinPose {
  const t = clamp01(progress);
  // sin(pi * t) is 0 at both ends and 1 at the midpoint, so the camera drops
  // and closes in as the block crosses the middle of the screen.
  const dive = Math.sin(Math.PI * t);

  return {
    theta: SPIN_START_THETA + t * Math.PI * 2,
    phi: 1.25 - dive * 0.7,
    radiusScale: 1.7 - dive * 0.45,
  };
}
