import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface CircuitTraceProps {
  scrollRef: RefObject<HTMLElement | null>;
  pageKey: string;
}

type OverlayType =
  | "led"
  | "capacitor"
  | "diode"
  | "mosfet"
  | "crystal"
  | "switch"
  | "battery"
  | "ground"
  | "fuse"
  | "polcap"
  | "potentiometer"
  | "ic"
  | "opamp"
  | "transformer"
  | "rectifier";

interface OverlayComponent {
  x: number;
  y: number;
  type: OverlayType;
  orientation: "v" | "h";
  triggerDist: number;
}

interface Branch {
  path: string;
  junctionDist: number;
  length: number;
  fillWindow: number;
}

interface Marker {
  x: number;
  y: number;
  triggerDist: number;
}

interface TraceGeometry {
  path: string;
  branches: Branch[];
  components: OverlayComponent[];
  vias: Marker[];
  junctions: Marker[];
  display: { x: number; y: number } | null;
  width: number;
  height: number;
  totalLength: number;
}

const LEFT_X = 22;
const MAX_BRANCHES = 8;
const SMALL_CYCLE: OverlayType[] = [
  "led",
  "capacitor",
  "diode",
  "fuse",
  "mosfet",
  "polcap",
  "crystal",
  "switch",
  "potentiometer",
  "battery",
  "ground",
];
const LARGE_CYCLE: OverlayType[] = ["ic", "opamp", "transformer"];
const BRANCH_CYCLE: OverlayType[] = ["capacitor", "diode", "led"];

// Seven-segment layout: A top, B top-right, C bottom-right, D bottom,
// E bottom-left, F top-left, G middle. Digit cell is 14x24.
const SEGMENT_LINES: Array<[number, number, number, number]> = [
  [2, 0, 12, 0], // A
  [14, 2, 14, 10], // B
  [14, 14, 14, 22], // C
  [2, 24, 12, 24], // D
  [0, 14, 0, 22], // E
  [0, 2, 0, 10], // F
  [2, 12, 12, 12], // G
];

const DIGIT_SEGMENTS: Record<string, number[]> = {
  "0": [0, 1, 2, 3, 4, 5],
  "1": [1, 2],
  "2": [0, 1, 6, 4, 3],
  "3": [0, 1, 6, 2, 3],
  "4": [5, 6, 1, 2],
  "5": [0, 5, 6, 2, 3],
  "6": [0, 5, 4, 3, 2, 6],
  "7": [0, 1, 2],
  "8": [0, 1, 2, 3, 4, 5, 6],
  "9": [0, 1, 2, 3, 5, 6],
  " ": [],
};

// Deterministic PRNG so the route is stable for a given layout (no flicker on
// re-measure) but varies across page sizes.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Approximate quadratic Bézier length by flattening into a short polyline.
function quadLength(x0: number, y0: number, qx: number, qy: number, x1: number, y1: number): number {
  let length = 0;
  let px = x0;
  let py = y0;
  const steps = 16;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * qx + t * t * x1;
    const y = mt * mt * y0 + 2 * mt * t * qy + t * t * y1;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
}

// Cursor-style path builder that accumulates distance-along-path as it emits
// segments, so components can record exactly when the bolt will reach them.
function createPathBuilder(startX: number, startY: number) {
  let d = `M${startX} ${startY}`;
  let cx = startX;
  let cy = startY;
  let dist = 0;

  return {
    lineTo(x: number, y: number) {
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      dist += Math.hypot(x - cx, y - cy);
      cx = x;
      cy = y;
    },
    quadTo(qx: number, qy: number, x: number, y: number) {
      d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      dist += quadLength(cx, cy, qx, qy, x, y);
      cx = x;
      cy = y;
    },
    get d() {
      return d;
    },
    get dist() {
      return dist;
    },
    get x() {
      return cx;
    },
    get y() {
      return cy;
    },
  };
}

type PathBuilder = ReturnType<typeof createPathBuilder>;

const INLINE_SPAN = 48;

// Inline geometry: the wire itself becomes the component.
function verticalResistor(pb: PathBuilder, x: number) {
  const amp = 7;
  let y = pb.y;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    y += 8;
    pb.lineTo(x + offset, y);
  }
}

function verticalInductor(pb: PathBuilder, x: number, bow: number) {
  let y = pb.y;
  for (let i = 0; i < 4; i += 1) {
    pb.quadTo(x + bow, y + 6, x, y + 12);
    y += 12;
  }
}

function horizontalResistor(pb: PathBuilder, y: number, dir: number) {
  const amp = 7;
  let x = pb.x;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    x += 8 * dir;
    pb.lineTo(x, y + offset);
  }
}

function horizontalInductor(pb: PathBuilder, y: number, dir: number) {
  let x = pb.x;
  for (let i = 0; i < 4; i += 1) {
    pb.quadTo(x + 6 * dir, y - 14, x + 12 * dir, y);
    x += 12 * dir;
  }
}

// Builds the route: a spine that weaves between the left and right gutters,
// crossing through the gaps between page sections with strict 90° corners,
// taking randomized rectangular detours under the (translucent) content,
// with parallel branches, schematic components scattered along the way, and
// a 7-seg readout in the last gap.
function buildTrace(width: number, height: number, gaps: Array<{ top: number; bottom: number }>): TraceGeometry {
  const rightX = Math.max(width - 26, LEFT_X + 200);
  const allowBranches = width >= 500;
  const rand = mulberry32(Math.round(width) * 31 + Math.round(height));
  const between = (a: number, b: number) => a + rand() * (b - a);
  const components: OverlayComponent[] = [];
  const branches: Branch[] = [];
  const vias: Marker[] = [];
  const junctions: Marker[] = [];
  let display: { x: number; y: number } | null = null;
  let smallIndex = 0;
  let largeIndex = 0;
  let branchCompIndex = 0;
  let side: "L" | "R" = "L";

  const nextSmall = (): OverlayType => SMALL_CYCLE[smallIndex++ % SMALL_CYCLE.length];
  const nextLarge = (): OverlayType => LARGE_CYCLE[largeIndex++ % LARGE_CYCLE.length];
  const nextBranch = (): OverlayType => BRANCH_CYCLE[branchCompIndex++ % BRANCH_CYCLE.length];

  const pb = createPathBuilder(LEFT_X, 0);
  let y = 0;

  const spineX = () => (side === "L" ? LEFT_X : rightX);
  // Deepest a detour or branch may reach toward the page center.
  const maxDepth = Math.min(220, (rightX - LEFT_X) * 0.42);

  // A rectangular parallel branch alongside a spine run, splitting near the
  // top and merging partway down — all 90° corners.
  const emitSpineBranch = (x: number, yStart: number, run: number) => {
    const ySplit = yStart + run * between(0.08, 0.18);
    const yMerge = yStart + run * between(0.45, 0.68);
    pb.lineTo(x, ySplit);
    const junctionDist = pb.dist;
    junctions.push({ x, y: ySplit, triggerDist: junctionDist });
    pb.lineTo(x, yMerge);
    const mergeDist = pb.dist;
    junctions.push({ x, y: yMerge, triggerDist: mergeDist });

    // Offset toward the content side; can dip under the translucent cards.
    const off = (side === "L" ? 1 : -1) * between(14, Math.max(20, maxDepth * 0.45));
    const bx = x + off;
    const bb = createPathBuilder(x, ySplit);
    bb.lineTo(bx, ySplit);
    const compY = (ySplit + yMerge) / 2;
    bb.lineTo(bx, compY);
    const compLocalDist = bb.dist;
    bb.lineTo(bx, yMerge);
    bb.lineTo(x, yMerge);

    const fillWindow = mergeDist - junctionDist;
    branches.push({ path: bb.d, junctionDist, length: bb.dist, fillWindow });
    components.push({
      x: bx,
      y: compY,
      type: nextBranch(),
      orientation: "v",
      triggerDist: junctionDist + (compLocalDist / bb.dist) * fillWindow,
    });
  };

  // A rectangular detour off the spine, wandering under the content and back.
  const emitDetour = (x: number, yEnd: number) => {
    const room = yEnd - pb.y - 70;
    if (room < 90) {
      return;
    }
    const dir = side === "L" ? 1 : -1;
    const depth = between(60, maxDepth);
    const yA = pb.y + between(20, Math.max(24, room - 160));
    const vLen = between(60, Math.min(160, yEnd - yA - 60));
    const dx = x + depth * dir;

    pb.lineTo(x, yA);
    pb.lineTo(dx, yA);
    vias.push({ x: dx, y: yA, triggerDist: pb.dist });
    const compY = yA + vLen / 2;
    pb.lineTo(dx, compY);
    components.push({ x: dx, y: compY, type: nextSmall(), orientation: "v", triggerDist: pb.dist });
    pb.lineTo(dx, yA + vLen);
    vias.push({ x: dx, y: yA + vLen, triggerDist: pb.dist });
    pb.lineTo(x, yA + vLen);
  };

  const emitSpineRun = (yEnd: number) => {
    const runLength = yEnd - y;
    if (runLength <= 0) {
      return;
    }
    const x = spineX();
    const hasBranch = allowBranches && runLength > 260 && branches.length < MAX_BRANCHES && rand() < 0.85;

    if (hasBranch) {
      emitSpineBranch(x, y, runLength);
    }

    // One inline component (resistor or inductor) on runs long enough,
    // dropped at a random spot below whatever the branch consumed.
    const remaining = yEnd - pb.y;
    if (remaining > 150) {
      const inlineY = pb.y + remaining * between(0.1, 0.32);
      pb.lineTo(x, inlineY);
      if (rand() < 0.5) {
        verticalResistor(pb, x);
      } else {
        // Inductor humps bow toward the page edge so they stay in the gutter.
        verticalInductor(pb, x, side === "L" ? -14 : 14);
      }
    }

    // Random rectangular detour(s) under the content.
    if (runLength > 250 && rand() < 0.8) {
      emitDetour(x, yEnd);
      if (runLength > 600 && rand() < 0.5) {
        emitDetour(x, yEnd);
      }
    }

    // Overlay components at random spacing on the rest of the run.
    for (let oy = pb.y + between(80, 160); oy < yEnd - 60; oy += between(220, 380)) {
      pb.lineTo(x, oy);
      components.push({ x, y: oy, type: nextSmall(), orientation: "v", triggerDist: pb.dist });
    }

    pb.lineTo(x, yEnd);
    y = yEnd;
  };

  // A rectangular parallel branch across a gap run, between xa and xb.
  const emitCrossingBranch = (xa: number, xb: number, crossY: number) => {
    const split = xa + (xb - xa) * between(0.28, 0.42);
    const rejoin = xa + (xb - xa) * between(0.62, 0.8);
    pb.lineTo(split, crossY);
    const junctionDist = pb.dist;
    junctions.push({ x: split, y: crossY, triggerDist: junctionDist });
    pb.lineTo(rejoin, crossY);
    const mergeDist = pb.dist;
    junctions.push({ x: rejoin, y: crossY, triggerDist: mergeDist });

    const by = crossY + 16;
    const bb = createPathBuilder(split, crossY);
    bb.lineTo(split, by);
    const compX = (split + rejoin) / 2;
    bb.lineTo(compX, by);
    const compLocalDist = bb.dist;
    bb.lineTo(rejoin, by);
    bb.lineTo(rejoin, crossY);

    const fillWindow = mergeDist - junctionDist;
    branches.push({ path: bb.d, junctionDist, length: bb.dist, fillWindow });
    components.push({
      x: compX,
      y: by,
      type: nextBranch(),
      orientation: "h",
      triggerDist: junctionDist + (compLocalDist / bb.dist) * fillWindow,
    });
  };

  const usableGaps = gaps.filter((gap) => gap.bottom - gap.top >= 70);

  // The tallest gap with enough span hosts the bridge-rectifier centerpiece.
  let rectifierGapIndex = -1;
  if (rightX - LEFT_X >= 300) {
    let best = 90;
    usableGaps.forEach((gap, index) => {
      const depth = gap.bottom - gap.top;
      if (depth >= best) {
        best = depth;
        rectifierGapIndex = index;
      }
    });
  }

  usableGaps.forEach((gap, gapIndex) => {
    const crossY = gap.top + (gap.bottom - gap.top) * between(0.32, 0.55);
    emitSpineRun(crossY - 20);

    const x = spineX();
    const isLastGap = gapIndex === usableGaps.length - 1;
    const crossesOver = gapIndex === 0 || rand() < 0.6;
    const farX = side === "L" ? rightX : LEFT_X;
    const dir = side === "L" ? 1 : -1;

    // 90° entry from the spine into the gap.
    pb.lineTo(x, crossY);
    vias.push({ x, y: crossY, triggerDist: pb.dist });

    const inboundX = x;
    const outboundEnd = crossesOver ? farX : farX - 26 * dir;
    const span = outboundEnd - inboundX;

    // Inline component early in the run.
    pb.lineTo(inboundX + span * between(0.08, 0.26), crossY);
    if (rand() < 0.5) {
      horizontalResistor(pb, crossY, dir);
    } else {
      horizontalInductor(pb, crossY, dir);
    }

    // Parallel branch across the middle of the run (needs gap depth for the
    // 16px jog below the wire).
    const branchFits =
      allowBranches && branches.length < MAX_BRANCHES && gap.bottom - crossY >= 40 && gapIndex !== rectifierGapIndex;
    if (branchFits) {
      emitCrossingBranch(inboundX, outboundEnd, crossY);
    }

    // A large schematic centerpiece on the run: the bridge rectifier in the
    // tallest gap, the usual cycle elsewhere.
    if (gapIndex === rectifierGapIndex && Math.abs(span) >= 300) {
      const largeX = inboundX + span * 0.5;
      pb.lineTo(largeX, crossY);
      components.push({ x: largeX, y: crossY, type: "rectifier", orientation: "v", triggerDist: pb.dist });
    } else {
      const largeX = inboundX + span * 0.86;
      pb.lineTo(largeX, crossY);
      components.push({ x: largeX, y: crossY, type: nextLarge(), orientation: "h", triggerDist: pb.dist });
    }

    if (isLastGap) {
      display = { x: rightX - 150, y: crossY + 22 };
    }

    if (crossesOver) {
      // Continue through to the opposite gutter: 90° turn onto the far spine.
      pb.lineTo(outboundEnd, crossY);
      vias.push({ x: outboundEnd, y: crossY, triggerDist: pb.dist });
      pb.lineTo(farX, crossY + 20);
      side = side === "L" ? "R" : "L";
      y = crossY + 20;
    } else {
      // Out-and-back excursion: jog down, return, 90° back onto the spine.
      pb.lineTo(outboundEnd, crossY);
      vias.push({ x: outboundEnd, y: crossY, triggerDist: pb.dist });
      pb.lineTo(outboundEnd, crossY + 14);
      pb.lineTo(x, crossY + 14);
      vias.push({ x, y: crossY + 14, triggerDist: pb.dist });
      y = crossY + 14;
    }
  });

  emitSpineRun(height - 4);

  return {
    path: pb.d,
    branches,
    components,
    vias,
    junctions,
    display,
    width,
    height,
    totalLength: pb.dist,
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Schematic symbols, drawn for vertical flow (+y); rotated -90° for horizontal.
function symbolFor(type: OverlayType): ReactNode {
  switch (type) {
    case "diode":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "led":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="-2" x2="16" y2="-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="3" x2="19" y2="-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "capacitor":
      return (
        <>
          <line x1="-9" y1="-4" x2="9" y2="-4" stroke="currentColor" strokeWidth="2.5" />
          <line x1="-9" y1="4" x2="9" y2="4" stroke="currentColor" strokeWidth="2.5" />
        </>
      );
    case "mosfet":
      return (
        <>
          <line x1="-15" y1="0" x2="-9" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-9" y1="-8" x2="-9" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="-5" y1="-8" x2="-5" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-5" y1="-8" x2="0" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-5" y1="8" x2="0" y2="8" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "crystal":
      return (
        <>
          <line x1="-8" y1="-7" x2="8" y2="-7" stroke="currentColor" strokeWidth="2" />
          <rect x="-6" y="-4" width="12" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="7" x2="8" y2="7" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "switch":
      return (
        <>
          <circle cx="0" cy="-8" r="2" fill="currentColor" />
          <circle cx="0" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="-8" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "battery":
      return (
        <>
          <line x1="-10" y1="-3" x2="10" y2="-3" stroke="currentColor" strokeWidth="2" />
          <line x1="-5" y1="3" x2="5" y2="3" stroke="currentColor" strokeWidth="3" />
        </>
      );
    case "fuse":
      return (
        <>
          <rect x="-5" y="-10" width="10" height="20" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <line x1="0" y1="-10" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "polcap":
      return (
        <>
          <line x1="-9" y1="-4" x2="9" y2="-4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M-9 7 Q0 1 9 7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="12" y1="-9" x2="18" y2="-9" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="-12" x2="15" y2="-6" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "potentiometer":
      return (
        <>
          <path d="M0 -14 L7 -10 L-7 -6 L7 -2 L-7 2 L7 6 L0 10 L0 14" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="16" y1="0" x2="9" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 0 L14 -3 L14 3 Z" fill="currentColor" />
        </>
      );
    case "ground":
      return (
        <>
          <line x1="-9" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="2" />
          <line x1="-6" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="2" />
          <line x1="-3" y1="10" x2="3" y2="10" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "opamp":
      return (
        <>
          <path d="M-11 -9 L11 -9 L0 11 Z" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-6" y1="-5" x2="-2" y2="-5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-4" y1="-7" x2="-4" y2="-3" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="-5" x2="6" y2="-5" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "ic":
      return (
        <>
          <line x1="-14" y1="-8" x2="-10" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="0" x2="-10" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="8" x2="-10" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="-8" x2="14" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="0" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-10" y="-13" width="20" height="26" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="0" cy="-9" r="1.5" fill="currentColor" />
        </>
      );
    case "transformer":
      return (
        <>
          <path d="M-5 -12 Q-12 -9 -5 -6 Q-12 -3 -5 0 Q-12 3 -5 6 Q-12 9 -5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 -12 Q12 -9 5 -6 Q12 -3 5 0 Q12 3 5 6 Q12 9 5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-1.5" y1="-12" x2="-1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1.5" y1="-12" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
        </>
      );
    case "rectifier":
      // Full AC→DC stage drawn horizontally: transformer, 4-diode bridge,
      // smoothing cap and load resistor shunted to ground off the DC rail.
      return (
        <>
          {/* Transformer */}
          <g transform="translate(-58 0)">
            <path d="M-5 -12 Q-12 -9 -5 -6 Q-12 -3 -5 0 Q-12 3 -5 6 Q-12 9 -5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 -12 Q12 -9 5 -6 Q12 -3 5 0 Q12 3 5 6 Q12 9 5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <line x1="-1.5" y1="-12" x2="-1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
            <line x1="1.5" y1="-12" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
          </g>
          <line x1="-46" y1="0" x2="-34" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {/* Diode bridge diamond */}
          <line x1="-34" y1="0" x2="-10" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="-20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-34" y1="0" x2="-10" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {[
            { x: -22, y: -10, angle: -40 },
            { x: 2, y: -10, angle: 40 },
            { x: -22, y: 10, angle: 40 },
            { x: 2, y: 10, angle: -40 },
          ].map(({ x, y, angle }) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path d="M-4 -4 L-4 4 L4 0 Z" fill="currentColor" />
              <line x1="4" y1="-4" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" />
            </g>
          ))}
          {[
            [-34, 0],
            [-10, -20],
            [14, 0],
            [-10, 20],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />
          ))}
          {/* DC rail */}
          <line x1="14" y1="0" x2="78" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {/* Smoothing capacitor to ground */}
          <line x1="34" y1="0" x2="34" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="27" y1="8" x2="41" y2="8" stroke="currentColor" strokeWidth="2.2" />
          <path d="M27 15 Q34 10 41 15" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="22" y1="3" x2="27" y2="3" stroke="currentColor" strokeWidth="1.2" />
          <line x1="24.5" y1="0.5" x2="24.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="34" y1="15" x2="34" y2="19" stroke="currentColor" strokeWidth="1.5" />
          <line x1="28" y1="19" x2="40" y2="19" stroke="currentColor" strokeWidth="1.8" />
          <line x1="31" y1="22" x2="37" y2="22" stroke="currentColor" strokeWidth="1.8" />
          <line x1="33" y1="25" x2="35" y2="25" stroke="currentColor" strokeWidth="1.8" />
          {/* Load resistor to ground */}
          <line x1="58" y1="0" x2="58" y2="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M58 4 L63 7 L53 11 L63 15 L53 19 L58 22" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="58" y1="22" x2="58" y2="25" stroke="currentColor" strokeWidth="1.5" />
          <line x1="52" y1="25" x2="64" y2="25" stroke="currentColor" strokeWidth="1.8" />
          <line x1="55" y1="28" x2="61" y2="28" stroke="currentColor" strokeWidth="1.8" />
          <line x1="57" y1="31" x2="59" y2="31" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
  }
}

export function CircuitTrace({ scrollRef, pageKey }: CircuitTraceProps) {
  const [geometry, setGeometry] = useState<TraceGeometry | null>(null);
  const litPathRef = useRef<SVGPathElement | null>(null);
  const boltRef = useRef<SVGGElement | null>(null);
  const componentRefs = useRef<Array<SVGGElement | null>>([]);
  const viaRefs = useRef<Array<SVGCircleElement | null>>([]);
  const junctionRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLitRefs = useRef<Array<SVGPathElement | null>>([]);
  const branchBoltRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLengthsRef = useRef<number[]>([]);
  const segmentRefs = useRef<Array<SVGLineElement | null>>([]);
  const totalLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  // Measure content + section gaps and (re)build the route.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const width = container.clientWidth;
      const height = container.scrollHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-section]"));
      const gaps: Array<{ top: number; bottom: number }> = [];
      for (let i = 0; i < sections.length - 1; i += 1) {
        gaps.push({
          top: sections[i].offsetTop + sections[i].offsetHeight,
          bottom: sections[i + 1].offsetTop,
        });
      }

      setGeometry(buildTrace(width, height, gaps));
    };

    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [scrollRef, pageKey]);

  // Drive the bolt, energized wake, branch fills, component lighting, and the display.
  useEffect(() => {
    if (!geometry || reducedMotion) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      rafRef.current = null;
      const litPath = litPathRef.current;
      const bolt = boltRef.current;
      if (!litPath || !bolt) {
        return;
      }

      const containerScrolls = container.scrollHeight > container.clientHeight + 4;
      const scrollTop = containerScrolls ? container.scrollTop : window.scrollY;
      const maxScroll = containerScrolls
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;

      const realLength = totalLengthRef.current;
      const distance = progress * realLength;
      litPath.style.strokeDashoffset = `${realLength - distance}`;

      const point = litPath.getPointAtLength(distance);
      bolt.setAttribute("transform", `translate(${point.x} ${point.y})`);

      // Analytic distance for triggers (branch fills, component lighting).
      const trigDist = progress * geometry.totalLength;

      for (let i = 0; i < geometry.branches.length; i += 1) {
        const branch = geometry.branches[i];
        const lit = branchLitRefs.current[i];
        const miniBolt = branchBoltRefs.current[i];
        const branchLength = branchLengthsRef.current[i] ?? 0;
        if (!lit || branchLength <= 0) {
          continue;
        }
        const t = Math.min(1, Math.max(0, (trigDist - branch.junctionDist) / branch.fillWindow));
        lit.style.strokeDashoffset = `${branchLength * (1 - t)}`;
        if (miniBolt) {
          if (t > 0 && t < 1) {
            const p = lit.getPointAtLength(t * branchLength);
            miniBolt.setAttribute("transform", `translate(${p.x} ${p.y})`);
            miniBolt.style.opacity = "1";
          } else {
            miniBolt.style.opacity = "0";
          }
        }
      }

      for (let i = 0; i < geometry.components.length; i += 1) {
        const group = componentRefs.current[i];
        if (group) {
          const passed = geometry.components[i].triggerDist <= trigDist + 1;
          group.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
          group.style.filter = passed ? "drop-shadow(0 0 5px var(--primary))" : "none";
        }
      }

      for (let i = 0; i < geometry.vias.length; i += 1) {
        const via = viaRefs.current[i];
        if (via) {
          via.style.fill = geometry.vias[i].triggerDist <= trigDist + 1 ? "var(--primary)" : "var(--surface-1)";
        }
      }

      for (let i = 0; i < geometry.junctions.length; i += 1) {
        const junction = junctionRefs.current[i];
        if (junction) {
          junction.style.fill =
            geometry.junctions[i].triggerDist <= trigDist + 1 ? "var(--primary)" : "var(--outline-strong)";
        }
      }

      // Seven-segment scroll percentage.
      if (geometry.display) {
        const chars = String(Math.round(progress * 100)).padStart(3, " ");
        for (let digit = 0; digit < 3; digit += 1) {
          const litSegments = DIGIT_SEGMENTS[chars[digit]] ?? [];
          for (let seg = 0; seg < 7; seg += 1) {
            const line = segmentRefs.current[digit * 7 + seg];
            if (line) {
              const lit = litSegments.includes(seg);
              line.style.stroke = lit ? "var(--primary)" : "var(--outline-strong)";
              line.style.opacity = lit ? "1" : "0.22";
            }
          }
        }
      }
    };

    const schedule = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    const litPath = litPathRef.current;
    if (litPath) {
      const length = litPath.getTotalLength();
      totalLengthRef.current = length;
      litPath.style.strokeDasharray = `${length}`;
      litPath.style.strokeDashoffset = `${length}`;
    }

    branchLengthsRef.current = geometry.branches.map((_, i) => {
      const lit = branchLitRefs.current[i];
      if (!lit) {
        return 0;
      }
      const length = lit.getTotalLength();
      lit.style.strokeDasharray = `${length}`;
      lit.style.strokeDashoffset = `${length}`;
      return length;
    });

    schedule();
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [geometry, reducedMotion, scrollRef]);

  if (!geometry) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0 hidden lg:block"
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      {/* Dormant trace */}
      <path
        d={geometry.path}
        fill="none"
        stroke="var(--outline-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.7"
      />

      {/* Dormant branch traces */}
      {geometry.branches.map((branch, index) => (
        <path
          key={`branch-dim-${index}`}
          d={branch.path}
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.7"
        />
      ))}

      {!reducedMotion ? (
        <>
          {/* Energized portion behind the bolt */}
          <path
            ref={litPathRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 70%, transparent))" }}
          />

          {/* Energized branch fills + mini-bolts */}
          {geometry.branches.map((branch, index) => (
            <path
              key={`branch-lit-${index}`}
              ref={(el) => {
                branchLitRefs.current[index] = el;
              }}
              d={branch.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 70%, transparent))" }}
            />
          ))}
          {geometry.branches.map((_, index) => (
            <circle
              key={`branch-bolt-${index}`}
              ref={(el) => {
                branchBoltRefs.current[index] = el;
              }}
              r="3"
              fill="var(--primary)"
              style={{ opacity: 0, filter: "drop-shadow(0 0 6px var(--primary))" }}
            />
          ))}

          {/* Traveling bolt: glow halo + bright core */}
          <g ref={boltRef}>
            <circle r="11" fill="var(--primary)" opacity="0.18" />
            <circle r="6" fill="var(--primary)" opacity="0.45" />
            <circle r="3" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 8px var(--primary))" }} />
          </g>
        </>
      ) : null}

      {/* Schematic components: light up as the current passes */}
      {geometry.components.map((component, index) => (
        <g
          key={`${component.type}-${component.x.toFixed(0)}-${component.y.toFixed(0)}`}
          ref={(el) => {
            componentRefs.current[index] = el;
          }}
          transform={`translate(${component.x} ${component.y})${component.orientation === "h" ? " rotate(-90)" : ""}`}
          style={{ color: "var(--outline-strong)", transition: "color 0.3s ease, filter 0.3s ease" }}
        >
          {symbolFor(component.type)}
        </g>
      ))}

      {/* Vias at crossing bends */}
      {geometry.vias.map((via, index) => (
        <circle
          key={`via-${via.x.toFixed(0)}-${via.y.toFixed(0)}`}
          ref={(el) => {
            viaRefs.current[index] = el;
          }}
          cx={via.x}
          cy={via.y}
          r="4"
          fill="var(--surface-1)"
          stroke="var(--outline-strong)"
          strokeWidth="2"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}

      {/* Junction dots where branches split and merge */}
      {geometry.junctions.map((junction, index) => (
        <circle
          key={`junction-${junction.x.toFixed(0)}-${junction.y.toFixed(0)}`}
          ref={(el) => {
            junctionRefs.current[index] = el;
          }}
          cx={junction.x}
          cy={junction.y}
          r="3"
          fill="var(--outline-strong)"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}

      {/* Seven-segment scroll readout */}
      {geometry.display ? (
        <g transform={`translate(${geometry.display.x} ${geometry.display.y})`}>
          {[0, 1, 2].map((digit) =>
            SEGMENT_LINES.map(([x1, y1, x2, y2], seg) => (
              <line
                key={`seg-${digit}-${seg}`}
                ref={(el) => {
                  segmentRefs.current[digit * 7 + seg] = el;
                }}
                x1={x1 + digit * 22}
                y1={y1}
                x2={x2 + digit * 22}
                y2={y2}
                stroke="var(--outline-strong)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.22"
              />
            )),
          )}
          <text
            x={3 * 22 + 6}
            y="22"
            fill="var(--text-muted)"
            fontSize="13"
            fontFamily="monospace"
          >
            %
          </text>
        </g>
      ) : null}
    </svg>
  );
}
