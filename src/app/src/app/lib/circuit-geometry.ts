// Pure placement math for the CircuitTrace background animation.
//
// Extracted verbatim from CircuitTrace.tsx so the thresholds are testable:
// the failure mode is silent — if a gap falls under MIN_GAP_DEPTH, or the
// horizontal room under a block's minAvail, that block simply never renders
// and nothing errors. Nothing here touches the DOM, React, or the animation
// loop; it takes measured rectangles and returns placement decisions.

export interface SectionRect {
  top: number;
  height: number;
}

export interface SectionGap {
  top: number;
  bottom: number;
}

export type CenterpieceKind = "rectifier" | "buck" | "ldo" | "mcu" | "fpga" | "timer555";

export interface CenterpiecePlan {
  kind: CenterpieceKind;
  scale: number;
}

/** A gap shallower than this drops its IC block entirely. */
export const MIN_GAP_DEPTH = 70;

/** Bus span (px) at or above which the full six-block chain is queued. */
export const FULL_CHAIN_MIN_SPAN = 420;

// Per-block horizontal requirement and body-scale curve, transcribed from the
// placement chain in buildTrace: s = min(maxScale, max(minScale, avail / divisor)).
export const CENTERPIECE_SPECS: Record<CenterpieceKind, { minAvail: number; maxScale: number; minScale: number; divisor: number }> = {
  rectifier: { minAvail: 300, maxScale: 2, minScale: 1.3, divisor: 260 },
  buck: { minAvail: 340, maxScale: 3.2, minScale: 1.5, divisor: 300 },
  ldo: { minAvail: 240, maxScale: 2.4, minScale: 1.3, divisor: 200 },
  mcu: { minAvail: 300, maxScale: 2.4, minScale: 1.3, divisor: 220 },
  fpga: { minAvail: 320, maxScale: 2.2, minScale: 1.3, divisor: 260 },
  timer555: { minAvail: 260, maxScale: 2.2, minScale: 1.3, divisor: 200 },
};

/**
 * Inter-section gaps for a stack of measured sections. N sections yield N-1
 * gaps, so the six portfolio sections give five placeable slots.
 */
export function computeGaps(sections: SectionRect[]): SectionGap[] {
  const gaps: SectionGap[] = [];
  for (let i = 0; i < sections.length - 1; i += 1) {
    gaps.push({
      top: sections[i].top + sections[i].height,
      bottom: sections[i + 1].top,
    });
  }
  return gaps;
}

/** Gaps deep enough to host an IC block. */
export function usableGaps(gaps: SectionGap[]): SectionGap[] {
  return gaps.filter((gap) => gap.bottom - gap.top >= MIN_GAP_DEPTH);
}

/** The power-chain block order; a narrow bus drops the rectifier and FPGA. */
export function centerpieceQueueFor(span: number): CenterpieceKind[] {
  return span >= FULL_CHAIN_MIN_SPAN
    ? ["rectifier", "buck", "ldo", "mcu", "fpga", "timer555"]
    : ["buck", "ldo", "mcu", "timer555"];
}

/** Whether the queue head fits in `avail` px, and at what scale. */
export function planCenterpiece(pending: CenterpieceKind | undefined, avail: number): CenterpiecePlan | null {
  if (!pending) {
    return null;
  }
  const spec = CENTERPIECE_SPECS[pending];
  if (avail < spec.minAvail) {
    return null;
  }
  return { kind: pending, scale: Math.min(spec.maxScale, Math.max(spec.minScale, avail / spec.divisor)) };
}

/** planCenterpiece, consuming the queue head when the block fits. */
export function takeCenterpiece(queue: CenterpieceKind[], avail: number): CenterpiecePlan | null {
  const plan = planCenterpiece(queue[0], avail);
  if (plan) {
    queue.shift();
  }
  return plan;
}

/**
 * Drain the queue across the usable gaps, one attempt per gap — the same walk
 * buildTrace performs while emitting, minus the drawing.
 */
export function placeCenterpieces(gaps: SectionGap[], avail: number, span = avail): CenterpiecePlan[] {
  const queue = centerpieceQueueFor(span);
  const placed: CenterpiecePlan[] = [];
  for (const _gap of usableGaps(gaps)) {
    const plan = takeCenterpiece(queue, avail);
    if (plan) {
      placed.push(plan);
    }
  }
  return placed;
}
