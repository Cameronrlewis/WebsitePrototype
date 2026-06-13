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
  // Direction current flows through the component: +1 = down/right, -1 = up/left.
  dir: 1 | -1;
  triggerDist: number;
  scale: number;
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
  ambientPaths: string[];
  ambientPads: Array<{ x: number; y: number }>;
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
];
const LARGE_CYCLE: OverlayType[] = ["ic", "opamp", "transformer"];
const BRANCH_CYCLE: OverlayType[] = ["capacitor", "diode", "led"];

// Half-extent of each symbol body along the wire axis (unscaled). Each
// component paints a background-colored occluder over this span so the wire
// doesn't show through the symbol. (The path itself must stay one continuous
// subpath — an M-break would restart the dash pattern per subpath and ruin
// the scroll reveal.)
const BODY_HALF: Record<OverlayType, number> = {
  led: 9,
  capacitor: 6,
  diode: 9,
  fuse: 10,
  mosfet: 9,
  polcap: 8,
  crystal: 8,
  switch: 9,
  battery: 4,
  potentiometer: 14,
  ground: 0,
  ic: 14,
  opamp: 12,
  transformer: 13,
  rectifier: 78,
};

// Flow-dash overlay: dash period and march speed (px/ms).
const FLOW_PERIOD = 20;
const FLOW_SPEED = 0.03;
const FLOW_WINDOW = 800;

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
  const span = rightX - LEFT_X;
  const mid = (LEFT_X + rightX) / 2;
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

  const nextSmall = (): OverlayType => SMALL_CYCLE[smallIndex++ % SMALL_CYCLE.length];
  const nextLarge = (): OverlayType => LARGE_CYCLE[largeIndex++ % LARGE_CYCLE.length];
  const nextBranch = (): OverlayType => BRANCH_CYCLE[branchCompIndex++ % BRANCH_CYCLE.length];

  const pb = createPathBuilder(between(LEFT_X, mid), 0);

  // Branches and centerpieces lean toward whichever half has more room.
  const dirFor = (x: number) => (x < mid ? 1 : -1);

  // Pick the next column in the opposite half so the route sweeps the full
  // page width as it descends.
  const pickColumn = (cur: number): number => {
    const toRight = cur < mid;
    const lo = toRight ? mid + span * 0.08 : LEFT_X;
    const hi = toRight ? rightX : mid - span * 0.08;
    return between(lo, hi);
  };

  // A rectangular parallel branch alongside a vertical leg, splitting near
  // the top and merging partway down — all 90° corners.
  const emitSpineBranch = (x: number, yStart: number, run: number, dir: number) => {
    const ySplit = yStart + run * between(0.08, 0.18);
    const yMerge = yStart + run * between(0.45, 0.68);
    pb.lineTo(x, ySplit);
    const junctionDist = pb.dist;
    junctions.push({ x, y: ySplit, triggerDist: junctionDist });
    pb.lineTo(x, yMerge);
    const mergeDist = pb.dist;
    junctions.push({ x, y: yMerge, triggerDist: mergeDist });

    const off = dir * between(24, Math.min(120, span * 0.2));
    const bx = Math.min(rightX, Math.max(LEFT_X, x + off));
    const bb = createPathBuilder(x, ySplit);
    bb.lineTo(bx, ySplit);
    const compY = (ySplit + yMerge) / 2;
    const type = nextBranch();
    bb.lineTo(bx, compY);
    const compLocalDist = bb.dist;
    bb.lineTo(bx, yMerge);
    bb.lineTo(x, yMerge);

    const fillWindow = mergeDist - junctionDist;
    branches.push({ path: bb.d, junctionDist, length: bb.dist, fillWindow });
    components.push({
      x: bx,
      y: compY,
      type,
      orientation: "v",
      dir: 1,
      triggerDist: junctionDist + (compLocalDist / bb.dist) * fillWindow,
      scale: 1.5,
    });
  };

  // A vertical leg at the current column, decorated with a possible parallel
  // branch, an inline resistor/inductor, and small components.
  const emitVerticalLeg = (yEnd: number) => {
    const x = pb.x;
    const legLength = yEnd - pb.y;
    if (legLength <= 0) {
      return;
    }

    if (allowBranches && legLength > 240 && branches.length < MAX_BRANCHES && rand() < 0.7) {
      emitSpineBranch(x, pb.y, legLength, dirFor(x));
    }

    const remaining = yEnd - pb.y;
    if (remaining > 150 && rand() < 0.65) {
      const inlineY = pb.y + remaining * between(0.1, 0.32);
      pb.lineTo(x, inlineY);
      if (rand() < 0.5) {
        verticalResistor(pb, x);
      } else {
        verticalInductor(pb, x, rand() < 0.5 ? -14 : 14);
      }
    }

    for (let oy = pb.y + between(70, 150); oy < yEnd - 50; oy += between(170, 320)) {
      pb.lineTo(x, oy);
      components.push({ x, y: oy, type: nextSmall(), orientation: "v", dir: 1, triggerDist: pb.dist, scale: 1.5 });
    }

    pb.lineTo(x, yEnd);
  };

  // A 90° horizontal jog to a new column, with via pads at the corners and
  // sometimes a component mid-wire.
  const emitHorizontalJog = (toX: number) => {
    const x = pb.x;
    const jy = pb.y;
    if (Math.abs(toX - x) < 40) {
      return;
    }
    const dir: 1 | -1 = toX > x ? 1 : -1;
    vias.push({ x, y: jy, triggerDist: pb.dist });
    // Occasional ground tap hanging off the corner via — grounds live on
    // stubs, never in series with the wire.
    if (rand() < 0.3) {
      components.push({ x, y: jy + 21, type: "ground", orientation: "v", dir: 1, triggerDist: pb.dist, scale: 1.5 });
    }
    if (Math.abs(toX - x) > 200 && rand() < 0.7) {
      const compX = x + (toX - x) * between(0.35, 0.65);
      pb.lineTo(compX, jy);
      components.push({ x: compX, y: jy, type: nextSmall(), orientation: "h", dir, triggerDist: pb.dist, scale: 1.5 });
    }
    pb.lineTo(toX, jy);
    vias.push({ x: toX, y: jy, triggerDist: pb.dist });
  };

  // Serpentine wanderer: drop, jog to the other half, repeat — the route
  // sweeps the entire page width instead of hugging the gutters.
  const emitWander = (yEnd: number) => {
    while (yEnd - pb.y > 280) {
      const legEnd = Math.min(pb.y + between(170, 360), yEnd - 90);
      emitVerticalLeg(legEnd);
      emitHorizontalJog(pickColumn(pb.x));
    }
    emitVerticalLeg(yEnd);
  };

  // A rectangular parallel branch across a gap run. Splits ahead of the
  // current cursor (never behind it — that would make the wire backtrack)
  // and leaves the back half of the run free for the gap centerpiece.
  const emitCrossingBranch = (xb: number, crossY: number) => {
    const xa = pb.x;
    const dir: 1 | -1 = xb > xa ? 1 : -1;
    const split = xa + (xb - xa) * between(0.08, 0.2);
    const rejoin = xa + (xb - xa) * between(0.42, 0.56);
    pb.lineTo(split, crossY);
    const junctionDist = pb.dist;
    junctions.push({ x: split, y: crossY, triggerDist: junctionDist });
    pb.lineTo(rejoin, crossY);
    const mergeDist = pb.dist;
    junctions.push({ x: rejoin, y: crossY, triggerDist: mergeDist });

    const by = crossY + 16;
    const bb = createPathBuilder(split, crossY);
    bb.lineTo(split, by);
    const type = nextBranch();
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
      type,
      orientation: "h",
      dir,
      triggerDist: junctionDist + (compLocalDist / bb.dist) * fillWindow,
      scale: 1.5,
    });
  };

  const usableGaps = gaps.filter((gap) => gap.bottom - gap.top >= 70);

  // The tallest gap with enough span hosts the bridge-rectifier centerpiece.
  let rectifierGapIndex = -1;
  if (span >= 420) {
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
    const gapDepth = gap.bottom - gap.top;
    const isLastGap = gapIndex === usableGaps.length - 1;
    const isRectifierGap = gapIndex === rectifierGapIndex;
    // The rectifier crosses high in its gap so its ground shunts fit below.
    const crossY = gap.top + gapDepth * (isRectifierGap ? between(0.24, 0.34) : between(0.32, 0.5));

    if (isRectifierGap) {
      // Guarantee a full-width left-to-right run for the rectifier: come in
      // from the far left before crossing (AC enters its transformer side).
      emitWander(crossY - between(60, 120));
      emitHorizontalJog(between(LEFT_X, LEFT_X + span * 0.15));
      pb.lineTo(pb.x, crossY);
    } else {
      emitWander(crossY);
    }

    const dir = dirFor(pb.x);
    const farX = dir > 0 ? rightX : LEFT_X;
    const runSpan = () => Math.abs(farX - pb.x);
    vias.push({ x: pb.x, y: crossY, triggerDist: pb.dist });

    // Inline component early in the run.
    if (runSpan() > 260) {
      pb.lineTo(pb.x + (farX - pb.x) * between(0.06, 0.2), crossY);
      if (rand() < 0.5) {
        horizontalResistor(pb, crossY, dir);
      } else {
        horizontalInductor(pb, crossY, dir);
      }
    }

    // Parallel branch across the front half of the remaining run (needs gap
    // depth for the 16px jog below the wire).
    const branchFits =
      allowBranches &&
      branches.length < MAX_BRANCHES &&
      gap.bottom - crossY >= 44 &&
      !isRectifierGap &&
      runSpan() > 340;
    if (branchFits) {
      emitCrossingBranch(farX, crossY);
    }

    // A large schematic centerpiece on the run: the bridge rectifier in the
    // tallest gap, the usual cycle elsewhere. The wire breaks across the
    // symbol body so it doesn't draw straight through it.
    let placedLarge = false;
    if (isRectifierGap) {
      // Scale is capped so the shunt legs stay inside the gap and the body
      // (±78 × scale) fits the remaining run.
      let rectScale = Math.min(2, Math.max(1.3, gapDepth / 70));
      rectScale = Math.min(rectScale, (gap.bottom - 8 - crossY) / 31, (runSpan() - 80) / 156);
      if (rectScale >= 1.15) {
        const largeX = pb.x + (farX - pb.x) * 0.5;
        pb.lineTo(largeX, crossY);
        components.push({ x: largeX, y: crossY, type: "rectifier", orientation: "v", dir: 1, triggerDist: pb.dist, scale: rectScale });
        placedLarge = true;
      }
    }
    if (!placedLarge && runSpan() > 220) {
      const largeX = pb.x + (farX - pb.x) * between(0.6, 0.82);
      pb.lineTo(largeX, crossY);
      components.push({ x: largeX, y: crossY, type: nextLarge(), orientation: "h", dir, triggerDist: pb.dist, scale: 2 });
    }

    if (isLastGap) {
      display = { x: rightX - 240, y: crossY + 12 };
    }

    // Finish the sweep and turn 90° down toward the next section.
    pb.lineTo(farX, crossY);
    vias.push({ x: farX, y: crossY, triggerDist: pb.dist });
    pb.lineTo(farX, crossY + 18);
  });

  emitWander(height - 4);

  // Ambient dormant network: decorative Manhattan squiggles with pads that
  // fill the rest of the page so the whole layout reads as a PCB. They avoid
  // the schematic symbols and the readout so they don't muddle the circuit.
  const obstacles: Array<{ x1: number; y1: number; x2: number; y2: number }> = components.map((c) => {
    const hx = (BODY_HALF[c.type] + 14) * c.scale;
    const hy = (c.type === "rectifier" ? 40 : BODY_HALF[c.type] + 14) * c.scale;
    return { x1: c.x - hx, y1: c.y - hy, x2: c.x + hx, y2: c.y + hy };
  });
  if (display !== null) {
    const d = display as { x: number; y: number };
    obstacles.push({ x1: d.x - 12, y1: d.y - 12, x2: d.x + 130, y2: d.y + 55 });
  }

  const hitsObstacle = (x1: number, y1: number, x2: number, y2: number) => {
    const lo = Math.min(x1, x2) - 6;
    const hi = Math.max(x1, x2) + 6;
    const top = Math.min(y1, y2) - 6;
    const bot = Math.max(y1, y2) + 6;
    return obstacles.some((o) => hi > o.x1 && lo < o.x2 && bot > o.y1 && top < o.y2);
  };

  const ambientPaths: string[] = [];
  const ambientPads: Array<{ x: number; y: number }> = [];
  const ambientCount = Math.min(10, Math.max(4, Math.round(height / 900)));
  for (let i = 0; i < ambientCount; i += 1) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let ax = between(LEFT_X, rightX);
      let ay = between(60, height - 140);
      const points: Array<[number, number]> = [[ax, ay]];
      let horizontal = rand() < 0.5;
      const segments = 3 + Math.floor(rand() * 3);
      let clear = true;
      for (let s = 0; s < segments; s += 1) {
        const len = between(60, 220) * (rand() < 0.5 ? -1 : 1);
        const nx = horizontal ? Math.min(rightX, Math.max(LEFT_X, ax + len)) : ax;
        const ny = horizontal ? ay : Math.min(height - 40, Math.max(30, ay + len));
        if (hitsObstacle(ax, ay, nx, ny)) {
          clear = false;
          break;
        }
        ax = nx;
        ay = ny;
        points.push([ax, ay]);
        horizontal = !horizontal;
      }
      if (!clear) {
        continue;
      }
      ambientPads.push({ x: points[0][0], y: points[0][1] });
      ambientPads.push({ x: ax, y: ay });
      ambientPaths.push(
        points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" "),
      );
      break;
    }
  }

  return {
    path: pb.d,
    branches,
    components,
    vias,
    junctions,
    display,
    ambientPaths,
    ambientPads,
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
          <line x1="0" y1="-14" x2="0" y2="2" stroke="currentColor" strokeWidth="1.5" />
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
          {/* AC input lead */}
          <line x1="-78" y1="0" x2="-68" y2="0" stroke="currentColor" strokeWidth="1.5" />
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
  const litGlowRef = useRef<SVGPathElement | null>(null);
  const flowPathRef = useRef<SVGPathElement | null>(null);
  const boltRef = useRef<SVGGElement | null>(null);
  const componentRefs = useRef<Array<SVGGElement | null>>([]);
  const viaRefs = useRef<Array<SVGCircleElement | null>>([]);
  const junctionRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLitRefs = useRef<Array<SVGPathElement | null>>([]);
  const branchGlowRefs = useRef<Array<SVGPathElement | null>>([]);
  const branchBoltRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLengthsRef = useRef<number[]>([]);
  const segmentRefs = useRef<Array<SVGLineElement | null>>([]);
  const prevLitRef = useRef<boolean[]>([]);
  const totalLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastMeasureRef = useRef<string>("");
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

      // Skip rebuilds when the layout hasn't actually changed: the
      // ResizeObserver refires during load (fonts, lazy images), and each
      // setGeometry tears down/rebuilds the animation effect, which both
      // resets the scroll reveal and risks wedging the rAF loop.
      const signature = `${Math.round(width)}x${Math.round(height)}:${gaps
        .map((g) => `${Math.round(g.top)}-${Math.round(g.bottom)}`)
        .join(",")}`;
      if (signature === lastMeasureRef.current) {
        return;
      }
      lastMeasureRef.current = signature;

      setGeometry(buildTrace(width, height, gaps));
    };

    // Force a rebuild on mount and whenever the view (pageKey) changes.
    lastMeasureRef.current = "";
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

    const targetDistance = () => {
      const containerScrolls = container.scrollHeight > container.clientHeight + 4;
      const scrollTop = containerScrolls ? container.scrollTop : window.scrollY;
      const maxScroll = containerScrolls
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
      return progress * totalLengthRef.current;
    };

    // The loop eases the displayed distance toward the scroll target each
    // frame (so dropped frames never read as stop-motion), keeps the flow
    // dashes marching for a moment after settling, then goes fully idle.
    let shown = 0;
    let prevShown = -1;
    let flowPhase = 0;
    let lastNow = performance.now();
    let settledAt = lastNow;
    let prevPct = -1;
    const prevVia: boolean[] = new Array(geometry.vias.length).fill(false);
    const prevJunction: boolean[] = new Array(geometry.junctions.length).fill(false);

    const update = (now: number) => {
      rafRef.current = null;
      const litPath = litPathRef.current;
      const bolt = boltRef.current;
      if (!litPath || !bolt) {
        return;
      }

      const dt = Math.min(64, now - lastNow);
      lastNow = now;
      const realLength = totalLengthRef.current;
      const target = targetDistance();
      shown += (target - shown) * Math.min(1, dt * 0.012);
      if (Math.abs(target - shown) < 0.5) {
        shown = target;
      }

      if (shown !== prevShown) {
        const offset = `${realLength - shown}`;
        litPath.style.strokeDashoffset = offset;
        const glow = litGlowRef.current;
        if (glow) {
          glow.style.strokeDashoffset = offset;
        }

        const point = litPath.getPointAtLength(shown);
        bolt.setAttribute("transform", `translate(${point.x} ${point.y})`);

        // Analytic distance for triggers (branch fills, component lighting).
        const trigDist = (shown / Math.max(1, realLength)) * geometry.totalLength;

        for (let i = 0; i < geometry.branches.length; i += 1) {
          const branch = geometry.branches[i];
          const lit = branchLitRefs.current[i];
          const branchGlow = branchGlowRefs.current[i];
          const miniBolt = branchBoltRefs.current[i];
          const branchLength = branchLengthsRef.current[i] ?? 0;
          if (!lit || branchLength <= 0) {
            continue;
          }
          const t = Math.min(1, Math.max(0, (trigDist - branch.junctionDist) / branch.fillWindow));
          const branchOffset = `${branchLength * (1 - t)}`;
          lit.style.strokeDashoffset = branchOffset;
          if (branchGlow) {
            branchGlow.style.strokeDashoffset = branchOffset;
          }
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

        // Components, vias, and junctions only get style writes on the frame
        // their lit state actually flips.
        for (let i = 0; i < geometry.components.length; i += 1) {
          const group = componentRefs.current[i];
          if (!group) {
            continue;
          }
          const passed = geometry.components[i].triggerDist <= trigDist + 1;
          if (passed === prevLitRef.current[i]) {
            continue;
          }
          prevLitRef.current[i] = passed;
          group.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
          group.style.filter = passed ? "drop-shadow(0 0 7px var(--primary))" : "none";
          if (passed) {
            group.style.animation = "none";
            void group.getBBox();
            group.style.animation = "circuit-pop 0.5s ease";
          } else {
            group.style.animation = "none";
          }
        }

        for (let i = 0; i < geometry.vias.length; i += 1) {
          const via = viaRefs.current[i];
          if (!via) {
            continue;
          }
          const passed = geometry.vias[i].triggerDist <= trigDist + 1;
          if (passed !== prevVia[i]) {
            prevVia[i] = passed;
            via.style.fill = passed ? "var(--primary)" : "var(--surface-1)";
          }
        }

        for (let i = 0; i < geometry.junctions.length; i += 1) {
          const junction = junctionRefs.current[i];
          if (!junction) {
            continue;
          }
          const passed = geometry.junctions[i].triggerDist <= trigDist + 1;
          if (passed !== prevJunction[i]) {
            prevJunction[i] = passed;
            junction.style.fill = passed ? "var(--primary)" : "var(--outline-strong)";
          }
        }

        // Seven-segment scroll percentage.
        if (geometry.display) {
          const pct = Math.round((shown / Math.max(1, realLength)) * 100);
          if (pct !== prevPct) {
            prevPct = pct;
            const chars = String(pct).padStart(3, " ");
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
        }
      }

      // Flow dashes: marching current confined to a trailing window behind
      // the bolt, built as a bounded dash list — no mask, no filter.
      const flow = flowPathRef.current;
      if (flow) {
        if (shown > 40) {
          flowPhase = (flowPhase + dt * FLOW_SPEED) % FLOW_PERIOD;
          const windowStart = Math.max(0, shown - FLOW_WINDOW);
          const lead = Math.max(0, windowStart + flowPhase - FLOW_PERIOD);
          const parts: string[] = [`0 ${lead.toFixed(1)}`];
          for (let covered = lead; covered < shown; covered += FLOW_PERIOD) {
            parts.push("6 14");
          }
          parts.push(`0 ${Math.ceil(realLength + 100)}`);
          flow.style.strokeDasharray = parts.join(" ");
        } else {
          flow.style.strokeDasharray = `0 ${Math.ceil(realLength + 100)}`;
        }
      }

      const moving = shown !== target || shown !== prevShown;
      prevShown = shown;
      if (moving) {
        settledAt = now;
        if (flow) {
          flow.style.opacity = "1";
        }
        schedule();
      } else if (now - settledAt < 1500) {
        schedule();
      } else if (flow) {
        flow.style.opacity = "0";
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
      const glow = litGlowRef.current;
      if (glow) {
        glow.style.strokeDasharray = `${length}`;
        glow.style.strokeDashoffset = `${length}`;
      }
    }
    prevLitRef.current = new Array(geometry.components.length).fill(false);
    // Snap to the current scroll position so rebuilds (resize, content
    // changes) don't replay the reveal from the top.
    shown = targetDistance();

    branchLengthsRef.current = geometry.branches.map((_, i) => {
      const lit = branchLitRefs.current[i];
      if (!lit) {
        return 0;
      }
      const length = lit.getTotalLength();
      lit.style.strokeDasharray = `${length}`;
      lit.style.strokeDashoffset = `${length}`;
      const branchGlow = branchGlowRefs.current[i];
      if (branchGlow) {
        branchGlow.style.strokeDasharray = `${length}`;
        branchGlow.style.strokeDashoffset = `${length}`;
      }
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
        // Must clear the ref: schedule() only arms a frame when this is null,
        // so leaving a stale id here permanently wedges the loop after a
        // geometry rebuild interrupts a mid-flight frame.
        rafRef.current = null;
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
      {/* Ambient dormant network: fills the board with extra copper */}
      {geometry.ambientPaths.map((d, index) => (
        <path
          key={`ambient-${index}`}
          d={d}
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.22"
        />
      ))}
      {geometry.ambientPads.map((pad, index) => (
        <circle
          key={`pad-${index}`}
          cx={pad.x}
          cy={pad.y}
          r="3.5"
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="1.5"
          opacity="0.26"
        />
      ))}

      {/* Dormant trace */}
      <path
        d={geometry.path}
        fill="none"
        stroke="var(--outline-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {/* Dormant branch traces */}
      {geometry.branches.map((branch, index) => (
        <path
          key={`branch-dim-${index}`}
          d={branch.path}
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity="0.6"
        />
      ))}

      {!reducedMotion ? (
        <>
          {/* Energized portion behind the bolt: soft glow underlay + bright
              core. Two plain strokes instead of an SVG filter so per-frame
              dashoffset updates never trigger full-page filter repaints. */}
          <path
            ref={litGlowRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.16"
          />
          <path
            ref={litPathRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Flowing current: marching dashes confined to a trailing window
              behind the bolt (dasharray rebuilt per frame, no mask). */}
          <path
            ref={flowPathRef}
            d={geometry.path}
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 35%, white)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0 1000000"
            style={{ opacity: 0, transition: "opacity 0.6s ease" }}
          />

          {/* Energized branch fills (glow underlay + core) + mini-bolts */}
          {geometry.branches.map((branch, index) => (
            <path
              key={`branch-glow-${index}`}
              ref={(el) => {
                branchGlowRefs.current[index] = el;
              }}
              d={branch.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.16"
            />
          ))}
          {geometry.branches.map((branch, index) => (
            <path
              key={`branch-lit-${index}`}
              ref={(el) => {
                branchLitRefs.current[index] = el;
              }}
              d={branch.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          ))}
          {geometry.branches.map((_, index) => (
            <circle
              key={`branch-bolt-${index}`}
              ref={(el) => {
                branchBoltRefs.current[index] = el;
              }}
              r="4"
              fill="var(--primary)"
              style={{ opacity: 0, filter: "drop-shadow(0 0 7px var(--primary))" }}
            />
          ))}

          {/* Traveling bolt: glow halo + bright core + radiating pulse ring */}
          <g ref={boltRef}>
            <circle r="16" fill="var(--primary)" opacity="0.14" />
            <circle r="9" fill="var(--primary)" opacity="0.4" />
            <circle r="4.5" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 10px var(--primary))" }} />
            <circle
              r="8"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              style={{
                animation: "circuit-pulse 1.6s ease-out infinite",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          </g>
        </>
      ) : null}

      {/* Schematic components: light up and pop as the current passes */}
      {geometry.components.map((component, index) => (
        <g
          key={`${component.type}-${component.x.toFixed(0)}-${component.y.toFixed(0)}`}
          transform={`translate(${component.x} ${component.y})${
            component.orientation === "h" ? ` rotate(${component.dir < 0 ? 90 : -90})` : ""
          } scale(${component.scale})`}
        >
          {/* Occluder: hides the wire (and its glow/flow dashes) under the
              symbol body so the trace reads as wired through the part. In
              local coords the wire always runs along +y, except the
              rectifier, which is drawn horizontally. */}
          {component.type === "ground" ? null : component.type === "rectifier" ? (
            <rect x={-BODY_HALF.rectifier} y={-8} width={BODY_HALF.rectifier * 2} height={16} fill="var(--background)" />
          ) : (
            <rect x={-8} y={-BODY_HALF[component.type]} width={16} height={BODY_HALF[component.type] * 2} fill="var(--background)" />
          )}
          <g
            ref={(el) => {
              componentRefs.current[index] = el;
            }}
            style={{
              color: "var(--outline-strong)",
              transition: "color 0.3s ease",
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          >
            {symbolFor(component.type)}
          </g>
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
          r="5"
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
          r="4"
          fill="var(--outline-strong)"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}

      {/* Seven-segment scroll readout */}
      {geometry.display ? (
        <g transform={`translate(${geometry.display.x} ${geometry.display.y}) scale(1.6)`}>
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
