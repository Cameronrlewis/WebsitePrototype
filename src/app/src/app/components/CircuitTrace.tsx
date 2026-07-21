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
  | "rectifier"
  | "buck"
  | "mcu"
  | "testpoint"
  | "res"
  | "gndvia"
  | "ldo"
  | "fpga"
  | "timer555"
  | "flash8"
  | "oscbox";

interface OverlayComponent {
  x: number;
  y: number;
  type: OverlayType;
  orientation: "v" | "h";
  // Direction current flows through the component: +1 = down/right, -1 = up/left.
  dir: 1 | -1;
  triggerDist: number;
  scale: number;
  // Electrical role: "series" sits in the main wire (2-terminal parts only);
  // "shunt" hangs off a stub to ground / across two nodes. Defaults to series.
  role?: "series" | "shunt";
  // Sequential reference designators for a composite's internal parts
  // (e.g. buck = [U, D, L, Cin, Cout]), assigned at placement time so
  // numbering stays sequential across the whole sheet.
  labels?: string[];
  // When the part sits on a timed branch, its pop follows that branch's
  // fill clock instead of the main-trace trigger distance.
  branchIndex?: number;
  branchFrac?: number;
}

interface Branch {
  path: string;
  junctionDist: number;
  length: number;
  fillWindow: number;
  // When set, the fill runs on its own clock once the front passes the
  // junction: t = elapsed / duration. Different durations per pin make the
  // fan-out currents visibly stream at different speeds.
  duration?: number;
  // Extra ms after the trigger before a timed fill starts — staggers a
  // block's nets so it sequences on pin by pin.
  delay?: number;
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
  // Reveal reparametrization: maps a monotonic "descent metric" (vertical
  // travel weighted heavily, horizontal travel weighted lightly) to analytic
  // path distance, so the lit front descends at a constant on-screen speed
  // regardless of how much wire is packed into any given vertical span.
  descent: Array<{ metric: number; dist: number }>;
  totalMetric: number;
  // Silkscreen layer: reference designators (static, muted) and net-name
  // flags (AC IN, +12V, +3V3, GND) that light as the current passes.
  texts: Array<{ x: number; y: number; text: string; size: number }>;
  netFlags: Array<{ x: number; y: number; text: string; triggerDist: number }>;
}

const LEFT_X = 22;
const MAX_BRANCHES = 8;
// Parts are placed by power-chain stage (see buildTrace), not by cosmetic
// cycles: the whole page reads as one AC→DC system — AC input → fuse/switch
// → bridge rectifier → +12V rail → buck converter → +3V3 rail → MCU →
// loads/indicators → ground return.

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
  buck: 30,
  mcu: 35,
  testpoint: 0,
  res: 10,
  gndvia: 0,
  ldo: 24,
  fpga: 55,
  timer555: 26,
  flash8: 15,
  oscbox: 12,
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
  // Per-vertex samples used to reparametrize the reveal by on-screen descent.
  const samples: Array<{ x: number; y: number; dist: number }> = [{ x: startX, y: startY, dist: 0 }];

  return {
    lineTo(x: number, y: number) {
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      dist += Math.hypot(x - cx, y - cy);
      cx = x;
      cy = y;
      samples.push({ x, y, dist });
    },
    quadTo(qx: number, qy: number, x: number, y: number) {
      d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      dist += quadLength(cx, cy, qx, qy, x, y);
      cx = x;
      cy = y;
      samples.push({ x, y, dist });
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
    get samples() {
      return samples;
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

// Builds the sheet like a real schematic: a power bus descends the left
// side of the page; every IC stage hangs off it as a branch sub-network
// with timed pin fan-outs, and power rails split off the stage outputs to
// run down the rest of the page in parallel — no serpentine snake.
function buildTrace(width: number, height: number, gaps: Array<{ top: number; bottom: number }>): TraceGeometry {
  const rightX = Math.max(width - 26, LEFT_X + 200);
  const span = rightX - LEFT_X;
  const allowBranches = width >= 500;
  const rand = mulberry32(Math.round(width) * 31 + Math.round(height));
  const between = (a: number, b: number) => a + rand() * (b - a);
  const components: OverlayComponent[] = [];
  const branches: Branch[] = [];
  const vias: Marker[] = [];
  const junctions: Marker[] = [];
  let display: { x: number; y: number } | null = null;

  const texts: TraceGeometry["texts"] = [];
  const netFlags: TraceGeometry["netFlags"] = [];

  // Sequential reference designators per prefix (R1, C2, U1…), assigned in
  // build order top-to-bottom like a real schematic sheet.
  const refCounts: Record<string, number> = {};
  const refdes = (prefix: string) => `${prefix}${(refCounts[prefix] = (refCounts[prefix] ?? 0) + 1)}`;

  // Power-chain narrative state. The stage advances as each block is placed:
  // input (AC side) → rail12 → rail33 → rail18 → load.
  let stage: "input" | "rail12" | "rail33" | "rail18" | "load" = "input";
  const inputQueue: OverlayType[] = ["fuse", "switch"];
  const centerpieceQueue: Array<"rectifier" | "buck" | "ldo" | "mcu" | "fpga" | "timer555"> =
    span >= 420 ? ["rectifier", "buck", "ldo", "mcu", "fpga", "timer555"] : ["buck", "ldo", "mcu", "timer555"];
  let loadToggle = 0;

  // The bus lives in the left band of the page; blocks extend rightward.
  const busHi = LEFT_X + Math.max(150, span * 0.22);

  // Reserved clear margin at the far right that no IC block enters, so
  // pass-through rails always have a lane to dodge into around each IC.
  const RAIL_GUTTER = Math.max(120, span * 0.1);
  const blockMaxX = rightX - RAIL_GUTTER;
  // Shared ground bus level where the trunk and every rail terminate — kept
  // close to the page bottom so 100% scroll reveals the whole chain.
  const groundY = height - 40;

  // Columns claimed by descending rails and block sub-nets. Horizontal
  // moves JUMP over these with the classic schematic crossover arc.
  const railColumns: number[] = [];

  // Generously padded keep-out boxes around each IC's full fan-out, so a
  // dodging rail gives the IC's branch complexity a wide berth.
  const icBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const addBox = (x1: number, y1: number, x2: number, y2: number) => {
    icBoxes.push({ x1: x1 - 40, y1: y1 - 34, x2: x2 + 40, y2: y2 + 34 });
  };

  // Pass-through rails can't see the ICs below them at emit time, so their
  // spawn is only recorded here and every rail is routed at the very end,
  // once all keep-out boxes exist.
  const railRequests: Array<{ fromX: number; fromY: number; count: number; jd: number }> = [];
  const requestRails = (fromX: number, fromY: number, count: number) => {
    railRequests.push({ fromX, fromY, count, jd: pb.dist });
  };

  // Horizontal bus move that hops over any claimed column it crosses.
  const hopTo = (toX: number, y: number) => {
    const dir = toX > pb.x ? 1 : -1;
    const cols = railColumns
      .filter((c) => (c - pb.x) * dir > 14 && (toX - c) * dir > 14)
      .sort((a, b) => (a - b) * dir);
    for (const c of cols) {
      pb.lineTo(c - 9 * dir, y);
      pb.quadTo(c, y - 16, c + 9 * dir, y);
    }
    pb.lineTo(toX, y);
  };

  // Pick the next bus column inside the left band, avoiding claimed columns.
  const pickColumn = (cur: number): number => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const c = between(LEFT_X, busHi);
      if (Math.abs(c - cur) >= 44 && railColumns.every((r) => Math.abs(r - c) > 30)) {
        return c;
      }
    }
    return between(LEFT_X, busHi);
  };

  // A shunt tap hanging off the bus: stub down to ground, optionally
  // through a smoothing/decoupling cap.
  const emitShuntStub = (x: number, y: number, capType: OverlayType | null) => {
    const tapDist = pb.dist;
    junctions.push({ x, y, triggerDist: tapDist });
    // Jog to the side first so the cap+ground read as a parallel shunt off the
    // bus, not a part sitting in series on the descending trunk.
    const off = x - 30 >= LEFT_X + 4 ? -30 : 30;
    const sx = x + off;
    const endY = y + (capType ? 32 : 22);
    const bb = createPathBuilder(x, y);
    bb.lineTo(sx, y);
    bb.lineTo(sx, endY);
    branches.push({ path: bb.d, junctionDist: tapDist, length: bb.dist, fillWindow: Math.max(1, bb.dist) });
    if (capType) {
      components.push({ x: sx, y: y + 13, type: capType, orientation: "v", dir: 1, role: "shunt", triggerDist: tapDist + Math.abs(off) + 5, scale: 1.4 });
      texts.push({ x: sx + 13, y: y + 17, text: refdes("C"), size: 9 });
    }
    components.push({ x: sx, y: endY, type: "gndvia", orientation: "v", dir: 1, role: "shunt", triggerDist: tapDist + Math.abs(off) + (capType ? 11 : 6), scale: 1.4 });
    texts.push({ x: sx + 9, y: endY + 4, text: "GND", size: 8 });
  };

  // Load-stage indicator leg: R→LED→GND stub tapped off the bus.
  const emitIndicatorStub = (x: number, y: number, dir: number) => {
    const tapDist = pb.dist;
    junctions.push({ x, y, triggerDist: tapDist });
    const bx = dir === 0 ? x : Math.min(rightX, Math.max(LEFT_X, x + dir * between(60, 110)));
    // Reserve the branch column so no descending bus/rail runs over its parts.
    if (bx !== x) {
      railColumns.push(bx);
    }
    const bb = createPathBuilder(x, y);
    if (bx !== x) {
      bb.lineTo(bx, y);
    }
    bb.lineTo(bx, y + 8);
    texts.push({ x: bx + 13, y: bb.y + 28, text: refdes("R"), size: 9 });
    verticalResistor(bb, bx);
    bb.lineTo(bx, bb.y + 12);
    const ledY = bb.y + 9;
    const ledLocal = bb.dist + 9;
    bb.lineTo(bx, ledY + 9);
    bb.lineTo(bx, ledY + 17);
    const fillWindow = 140;
    components.push({ x: bx, y: ledY, type: "led", orientation: "v", dir: 1, role: "shunt", triggerDist: tapDist + (ledLocal / bb.dist) * fillWindow, scale: 1.4 });
    texts.push({ x: bx + 15, y: ledY + 4, text: refdes("D"), size: 9 });
    components.push({ x: bx, y: ledY + 17, type: "ground", orientation: "v", dir: 1, role: "shunt", triggerDist: tapDist + fillWindow, scale: 1.4 });
    branches.push({ path: bb.d, junctionDist: tapDist, length: bb.dist, fillWindow });
  };

  // Registers a timed fan-out net and the parts sitting on it; each part's
  // pop follows the net's own fill clock. `delay` staggers nets so a block
  // visibly sequences on, pin by pin.
  const pushNet = (
    bb: PathBuilder,
    junctionDist: number,
    duration: number,
    parts: Array<{
      x: number;
      y: number;
      type: OverlayType;
      at: number;
      scale: number;
      dir?: 1 | -1;
      orientation?: "v" | "h";
      ref?: string;
      refDx?: number;
      refDy?: number;
    }>,
    delay = 0,
  ): number => {
    const bi = branches.length;
    branches.push({ path: bb.d, junctionDist, length: bb.dist, fillWindow: 1, duration, delay });
    for (const p of parts) {
      components.push({
        x: p.x,
        y: p.y,
        type: p.type,
        orientation: p.orientation ?? "v",
        dir: p.dir ?? 1,
        role: "shunt",
        triggerDist: junctionDist,
        scale: p.scale,
        branchIndex: bi,
        branchFrac: Math.min(1, p.at / Math.max(1, bb.dist)),
      });
      if (p.ref) {
        // Offsets scale with the part so the label clears the (scaled) glyph.
        const sc = Math.max(1, p.scale);
        texts.push({ x: p.x + (p.refDx ?? 12) * sc, y: p.y + (p.refDy ?? 4) * Math.max(1, p.scale * 0.8), text: p.ref, size: 9 });
      }
    }
    return bi;
  };

  // ——— Descending power rails, built once every IC keep-out box is known.
  // Each rail rests in a mid-page "home" column where it drops series parts,
  // and bows out into the reserved right gutter to clear each IC block it
  // passes (staying well clear of the IC's own branches), returning between
  // blocks. At the bottom every rail ties into a common ground collector.
  const buildAllRails = () => {
    const partCycle: OverlayType[] = ["res", "led", "switch", "res", "fuse", "led"];
    let pc = Math.floor(rand() * partCycle.length);
    const CLEAR = 50;
    const totalLen = pb.dist;
    const homeLo = busHi + 60;
    const homeHi = blockMaxX - 40;
    const railXs: number[] = [];
    let railK = 0;

    for (const req of railRequests) {
      for (let c = 0; c < req.count; c += 1) {
        const k = railK++;
        const fy = req.fromY + c * 26;
        const jd = req.jd;
        // Home column (used only in the clear gaps between chips), staggered
        // per rail so they don't stack.
        let homeX = homeLo + (homeHi - homeLo) * (0.3 + 0.25 * (k % 3)) + between(-18, 18);
        homeX = Math.min(homeHi, Math.max(homeLo, homeX));
        let guard = 0;
        while (railXs.some((r) => Math.abs(r - homeX) < 40) && guard++ < 12) {
          homeX += 46;
          if (homeX > homeHi) {
            homeX = homeLo + (homeX - homeHi);
          }
        }
        railXs.push(homeX);
        // Dodge lane in the reserved gutter, clear of every keep-out box.
        const dodgeX = Math.min(rightX - 14, rightX - 14 - (k % 3) * 20);

        const parts: Array<{ x: number; y: number; type: OverlayType; at: number }> = [];
        const bb = createPathBuilder(req.fromX, fy);
        junctions.push({ x: req.fromX, y: fy, triggerDist: jd });

        // Horizontal run inward that hops other rails' home columns.
        const runTo = (toX: number, atY: number) => {
          const d = toX > bb.x ? 1 : -1;
          for (const r of railXs
            .filter((rr) => rr !== homeX && (rr - bb.x) * d > 14 && (toX - rr) * d > 14)
            .sort((a, b) => (a - b) * d)) {
            bb.lineTo(r - 9 * d, atY);
            bb.quadTo(r, atY - 16, r + 9 * d, atY);
          }
          bb.lineTo(toX, atY);
        };

        // 1. Exit the block output straight out into the gutter dodge lane.
        bb.lineTo(dodgeX, fy);

        // 2. Ride the gutter over every chip below the spawn, coming inward
        //    to the home column only in the clear gaps between them.
        const boxes = icBoxes.filter((box) => box.y2 > fy + 4).sort((a, b) => a.y1 - b.y1);
        for (let bi = 0; bi < boxes.length; bi += 1) {
          let backY = boxes[bi].y2 + CLEAR;
          while (bi + 1 < boxes.length && boxes[bi + 1].y1 - CLEAR - backY < 150) {
            bi += 1;
            backY = boxes[bi].y2 + CLEAR;
          }
          // Descend the gutter past this (merged) chip.
          bb.lineTo(dodgeX, backY);
          const nextTop = bi + 1 < boxes.length ? boxes[bi + 1].y1 - CLEAR : groundY - 30;
          if (nextTop - backY > 170) {
            // Clear gap: come inward, drop a series part on the STRAIGHT
            // vertical run (never on the turn — a part on a 90° corner reads
            // as an illegal bend through the symbol), then head back out.
            runTo(homeX, backY);
            const partY = backY + (nextTop - backY) * 0.35;
            const type = partCycle[pc++ % partCycle.length];
            bb.lineTo(homeX, partY);
            parts.push({ x: homeX, y: partY, type, at: bb.dist });
            const midY = backY + (nextTop - backY) * 0.62;
            bb.lineTo(homeX, midY);
            if (bi + 1 < boxes.length) {
              runTo(dodgeX, midY);
            }
          }
        }

        // 3. Final descent in the home column to the ground collector.
        if (Math.abs(bb.x - homeX) > 2) {
          runTo(homeX, bb.y);
        }
        let yy = bb.y;
        while (yy < groundY - 200) {
          yy += between(210, 340);
          if (yy >= groundY - 70) {
            break;
          }
          const type = partCycle[pc++ % partCycle.length];
          bb.lineTo(homeX, yy);
          parts.push({ x: homeX, y: yy, type, at: bb.dist });
        }
        bb.lineTo(homeX, groundY);

        // Fill in lockstep with the descent: the rail's lit front tracks the
        // scroll (reaches the bottom exactly as the main bolt does), rather
        // than racing ahead.
        const fillWindow = Math.max(300, totalLen - jd);
        branches.push({ path: bb.d, junctionDist: jd, length: bb.dist, fillWindow });
        for (const p of parts) {
          components.push({ x: p.x, y: p.y, type: p.type, orientation: "v", dir: 1, triggerDist: jd + (p.at / bb.dist) * fillWindow, scale: 1.6 });
          texts.push({
            x: p.x + 20,
            y: p.y + 4,
            text: refdes(p.type === "res" ? "R" : p.type === "led" ? "D" : p.type === "switch" ? "SW" : "F"),
            size: 9,
          });
        }
        // Each rail returns to ground on its own via (after its series
        // loads) — no shared collector shorting the live rails together.
        components.push({ x: homeX, y: groundY, type: "ground", orientation: "v", dir: 1, role: "shunt", triggerDist: jd + fillWindow, scale: 1.6 });
      }
    }
  };

  // ——— Bridge rectifier block hanging off the bus: entry lead → the full
  // AC→DC composite → +12V output node where the first rail splits off.
  const emitRectifierBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cxc = pb.x + 100 * s;
    // A transformer is a magnetic break, so the lit chain covers the DC side
    // only (secondary/bridge → +12V); the primary is fed by two leads that tap
    // the main bus (below), never a single wire piercing the transformer.
    const bc = createPathBuilder(cxc + 14 * s, y);
    bc.lineTo(cxc + 100 * s, y);
    const bi = pushNet(bc, jd, 800, []);
    // Transformer primary: two horizontal leads whose vertical runs ride the
    // main bus and whose horizontals stem into the primary terminals.
    junctions.push({ x: pb.x, y: y - 14 * s, triggerDist: jd });
    junctions.push({ x: pb.x, y: y + 14 * s, triggerDist: jd });
    {
      const pTop = createPathBuilder(pb.x, y);
      pTop.lineTo(pb.x, y - 14 * s);
      pTop.lineTo(cxc - 68 * s, y - 14 * s);
      pushNet(pTop, jd, 380, [], 0);
      const pBot = createPathBuilder(pb.x, y);
      pBot.lineTo(pb.x, y + 14 * s);
      pBot.lineTo(cxc - 68 * s, y + 14 * s);
      pushNet(pBot, jd, 380, [], 40);
    }
    components.push({
      x: cxc,
      y,
      type: "rectifier",
      orientation: "v",
      dir: 1,
      triggerDist: jd,
      scale: s,
      labels: [refdes("T"), refdes("C"), refdes("R")],
      branchIndex: bi,
      branchFrac: 0.12,
    });
    netFlags.push({ x: cxc + 100 * s + 34, y: y - 14, text: "+12V", triggerDist: jd });
    addBox(pb.x, y - 44 * s, cxc + 100 * s, y + 44 * s);
    requestRails(cxc + 100 * s, y, 1);
  };

  // ——— Buck converter block: the hero. TPS54331-style stage hanging off
  // the bus; the chain streams rightward while every pin's sub-circuit
  // powers on at its own delay + speed. Spread wide so each net is legible.
  const emitBuckBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cx = pb.x + 84 * s;
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.3, s * 0.62);
    texts.push({ x: X(-8), y: Y(-30), text: refdes("U"), size: 12 });
    texts.push({ x: X(46), y: Y(-8), text: "SW", size: 9 });

    // Main chain: bus → VIN → through the package → L → output → FB column.
    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-64), y);
    const enAt = bc.dist;
    bc.lineTo(X(-40), y);
    const cinAt = bc.dist;
    bc.lineTo(X(44), y);
    const phAt = bc.dist;
    for (let i = 0; i < 5; i += 1) {
      bc.quadTo(bc.x + 7 * s, y - 17 * s, bc.x + 14 * s, y);
    }
    bc.lineTo(X(122), y);
    const outAt = bc.dist;
    bc.lineTo(X(148), y);
    const bulkAt = bc.dist;
    bc.lineTo(X(176), y);
    const chain = pushNet(bc, jd, 1300, []);
    components.push({ x: X(0), y, type: "buck", orientation: "v", dir: 1, triggerDist: jd, scale: s, branchIndex: chain, branchFrac: cinAt / bc.dist });
    junctions.push({ x: X(-64), y, triggerDist: jd });
    junctions.push({ x: X(-40), y, triggerDist: jd + 10 });
    junctions.push({ x: X(44), y, triggerDist: jd + 20 });
    junctions.push({ x: X(122), y, triggerDist: jd + 30 });
    junctions.push({ x: X(148), y, triggerDist: jd + 40 });
    texts.push({ x: X(96), y: Y(-24), text: refdes("L"), size: 11 });

    // EN strap tied to VIN.
    {
      const bb = createPathBuilder(X(-64), y);
      bb.lineTo(X(-64), Y(14));
      bb.lineTo(X(-38), Y(14));
      pushNet(bb, jd, 420, [], (enAt / bc.dist) * 1300);
    }
    // Input cap → GND via.
    {
      const bb = createPathBuilder(X(-40), y);
      bb.lineTo(X(-40), Y(72));
      pushNet(
        bb,
        jd,
        700,
        [
          { x: X(-40), y: Y(38), type: "capacitor", at: 38 * s, scale: ps, ref: refdes("C") },
          { x: X(-40), y: Y(72), type: "gndvia", at: 72 * s, scale: ps },
        ],
        (cinAt / bc.dist) * 1300,
      );
    }
    // Bottom pins: SS soft-start, GND stitch, COMP RC — spread wide.
    {
      const bb = createPathBuilder(X(-14), Y(28));
      bb.lineTo(X(-14), Y(52));
      bb.lineTo(X(-44), Y(52));
      bb.lineTo(X(-44), Y(88));
      pushNet(
        bb,
        jd,
        1150,
        [
          { x: X(-44), y: Y(68), type: "capacitor", at: (24 + 30 + 16) * s, scale: ps, ref: refdes("C"), refDx: -28 },
          { x: X(-44), y: Y(88), type: "gndvia", at: (24 + 30 + 36) * s, scale: ps },
        ],
        500,
      );
    }
    {
      const bb = createPathBuilder(X(0), Y(22));
      bb.lineTo(X(0), Y(48));
      pushNet(bb, jd, 460, [{ x: X(0), y: Y(48), type: "gndvia", at: 26 * s, scale: ps }], 450);
    }
    {
      const bb = createPathBuilder(X(14), Y(28));
      bb.lineTo(X(14), Y(96));
      pushNet(
        bb,
        jd,
        1350,
        [
          { x: X(14), y: Y(44), type: "res", at: 16 * s, scale: ps, ref: refdes("R") },
          { x: X(14), y: Y(68), type: "capacitor", at: 40 * s, scale: ps, ref: refdes("C") },
          { x: X(14), y: Y(96), type: "gndvia", at: 68 * s, scale: ps },
        ],
        600,
      );
    }
    // Bootstrap cap routed over the package: BOOT → PH node.
    {
      const bb = createPathBuilder(X(-30), Y(-14));
      bb.lineTo(X(-46), Y(-14));
      bb.lineTo(X(-46), Y(-64));
      bb.lineTo(X(44), Y(-64));
      bb.lineTo(X(44), y);
      pushNet(
        bb,
        jd,
        1000,
        [
          {
            x: X(-1),
            y: Y(-64),
            type: "capacitor",
            orientation: "h",
            at: (16 + 50 + 45) * s,
            scale: ps,
            ref: refdes("C"),
            refDy: -12,
          },
        ],
        (phAt / bc.dist) * 1300,
      );
    }
    // Catch diode: anode at ground, cathode at the PH node. Freewheel
    // current rises from ground up into PH, so the net is built (and
    // animated) bottom-up and the diode arrow points up.
    {
      const bb = createPathBuilder(X(44), Y(64));
      bb.lineTo(X(44), y);
      pushNet(
        bb,
        jd,
        720,
        [
          { x: X(44), y: Y(64), type: "gndvia", at: 0, scale: ps },
          { x: X(44), y: Y(32), type: "diode", dir: -1, at: 32 * s, scale: ps, ref: refdes("D") },
        ],
        (phAt / bc.dist) * 1300,
      );
    }
    // Output filter: ceramic + bulk → GND vias.
    {
      const bb = createPathBuilder(X(122), y);
      bb.lineTo(X(122), Y(72));
      pushNet(
        bb,
        jd,
        800,
        [
          { x: X(122), y: Y(38), type: "capacitor", at: 38 * s, scale: ps, ref: refdes("C") },
          { x: X(122), y: Y(72), type: "gndvia", at: 72 * s, scale: ps },
        ],
        (outAt / bc.dist) * 1300,
      );
    }
    {
      const bb = createPathBuilder(X(148), y);
      bb.lineTo(X(148), Y(72));
      pushNet(
        bb,
        jd,
        950,
        [
          { x: X(148), y: Y(38), type: "polcap", at: 38 * s, scale: ps, ref: refdes("C") },
          { x: X(148), y: Y(72), type: "gndvia", at: 72 * s, scale: ps },
        ],
        (bulkAt / bc.dist) * 1300 + 120,
      );
    }
    // FB divider with the tap hopped back over the output nets to VSENSE.
    {
      const bb = createPathBuilder(X(176), y);
      bb.lineTo(X(176), Y(96));
      pushNet(
        bb,
        jd,
        1500,
        [
          { x: X(176), y: Y(28), type: "res", at: 28 * s, scale: ps, ref: refdes("R") },
          { x: X(176), y: Y(76), type: "res", at: 76 * s, scale: ps, ref: refdes("R") },
          { x: X(176), y: Y(96), type: "gndvia", at: 96 * s, scale: ps },
        ],
        1300,
      );
      junctions.push({ x: X(176), y: Y(54), triggerDist: jd + 60 });
      const tap = createPathBuilder(X(176), Y(54));
      for (const c of [148, 122]) {
        tap.lineTo(X(c + 4), Y(54));
        tap.quadTo(X(c), Y(54) - 14, X(c - 4), Y(54));
      }
      tap.lineTo(X(64), Y(54));
      tap.lineTo(X(64), Y(14));
      tap.lineTo(X(38), Y(14));
      pushNet(tap, jd, 1800, [], 1500);
    }

    netFlags.push({ x: X(176) + 40, y: y - 18, text: "+3V3", triggerDist: jd });
    for (const lx of [-40, -24, 0, 24, 44, 122, 148, 176]) {
      railColumns.push(X(lx));
    }
    addBox(X(-64), Y(-64), X(176), Y(96));
    requestRails(X(176), y, span >= 900 ? 2 : 1);
  };

  // ——— LDO block: AMS1117-1.8 dropping the 3V3 rail to the FPGA core
  // voltage. Cin → 3-pin regulator → Cout → +1V8.
  const emitLdoBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cx = pb.x + 56 * s;
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.25, s * 0.7);
    texts.push({ x: X(-8), y: Y(-24), text: refdes("U"), size: 11 });

    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-36), y);
    const cinAt = bc.dist;
    bc.lineTo(X(36), y);
    bc.lineTo(X(64), y);
    const coutAt = bc.dist;
    bc.lineTo(X(92), y);
    const chain = pushNet(bc, jd, 900, []);
    components.push({ x: X(0), y, type: "ldo", orientation: "v", dir: 1, triggerDist: jd, scale: s, branchIndex: chain, branchFrac: cinAt / bc.dist });
    junctions.push({ x: X(-36), y, triggerDist: jd });
    junctions.push({ x: X(64), y, triggerDist: jd + 10 });
    {
      const bb = createPathBuilder(X(-36), y);
      bb.lineTo(X(-36), Y(52));
      pushNet(
        bb,
        jd,
        600,
        [
          { x: X(-36), y: Y(26), type: "capacitor", at: 26 * s, scale: ps, ref: refdes("C") },
          { x: X(-36), y: Y(52), type: "gndvia", at: 52 * s, scale: ps },
        ],
        (cinAt / bc.dist) * 900,
      );
    }
    {
      const bb = createPathBuilder(X(0), Y(16));
      bb.lineTo(X(0), Y(40));
      pushNet(bb, jd, 420, [{ x: X(0), y: Y(40), type: "gndvia", at: 24 * s, scale: ps }], 400);
    }
    {
      const bb = createPathBuilder(X(64), y);
      bb.lineTo(X(64), Y(52));
      pushNet(
        bb,
        jd,
        700,
        [
          { x: X(64), y: Y(26), type: "polcap", at: 26 * s, scale: ps, ref: refdes("C") },
          { x: X(64), y: Y(52), type: "gndvia", at: 52 * s, scale: ps },
        ],
        (coutAt / bc.dist) * 900,
      );
    }
    // +1V8 output test point (gives the rail a real terminal, not a
    // floating label).
    components.push({ x: X(92), y, type: "testpoint", orientation: "v", dir: 1, triggerDist: jd, scale: ps, branchIndex: chain, branchFrac: coutAt / bc.dist });
    netFlags.push({ x: X(92), y: y - 30, text: "+1V8", triggerDist: jd });
    for (const lx of [-36, 0, 64]) {
      railColumns.push(X(lx));
    }
    addBox(X(-36), Y(-30), X(92), Y(52));
  };

  // ——— MCU block: ESP32-S3 module with support circuitry on staggered
  // power-on clocks — decoupling, EN pull-up, crystal + load caps, status LED.
  const emitMcuBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cx = pb.x + 82 * s;
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.25, s * 0.6);
    texts.push({ x: X(-10), y: Y(-38), text: refdes("U"), size: 11 });

    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-66), y);
    const decAt = bc.dist;
    bc.lineTo(X(43), y);
    bc.lineTo(X(66), y);
    const ledAt = bc.dist;
    const chain = pushNet(bc, jd, 1000, []);
    components.push({ x: X(0), y, type: "mcu", orientation: "v", dir: 1, triggerDist: jd, scale: s, branchIndex: chain, branchFrac: decAt / bc.dist });
    junctions.push({ x: X(-66), y, triggerDist: jd });
    junctions.push({ x: X(66), y, triggerDist: jd + 10 });
    {
      const bb = createPathBuilder(X(-66), y);
      bb.lineTo(X(-66), Y(56));
      pushNet(
        bb,
        jd,
        600,
        [
          { x: X(-66), y: Y(28), type: "capacitor", at: 28 * s, scale: ps, ref: refdes("C") },
          { x: X(-66), y: Y(56), type: "gndvia", at: 56 * s, scale: ps },
        ],
        (decAt / bc.dist) * 1000,
      );
    }
    {
      const bb = createPathBuilder(X(-66), y);
      bb.lineTo(X(-66), Y(-16));
      bb.lineTo(X(-43), Y(-16));
      pushNet(
        bb,
        jd,
        850,
        [{ x: X(-54), y: Y(-16), type: "res", orientation: "h", at: (16 + 12) * s, scale: ps, ref: refdes("R"), refDy: -10 }],
        (decAt / bc.dist) * 1000 + 150,
      );
    }
    // Crystal cluster, spread deeper.
    {
      const cyRow = Y(58);
      const left = createPathBuilder(X(-12), Y(34));
      left.lineTo(X(-12), cyRow);
      left.lineTo(X(-12), cyRow + 20 * s);
      pushNet(
        left,
        jd,
        900,
        [
          { x: X(-12), y: cyRow + 10 * s, type: "capacitor", at: 40 * s, scale: ps, ref: refdes("C"), refDx: -28 },
          { x: X(-12), y: cyRow + 20 * s, type: "gndvia", at: 999, scale: ps },
        ],
        600,
      );
      const right = createPathBuilder(X(12), Y(34));
      right.lineTo(X(12), cyRow);
      right.lineTo(X(12), cyRow + 20 * s);
      pushNet(
        right,
        jd,
        1050,
        [
          { x: X(12), y: cyRow + 10 * s, type: "capacitor", at: 40 * s, scale: ps, ref: refdes("C") },
          { x: X(12), y: cyRow + 20 * s, type: "gndvia", at: 999, scale: ps },
        ],
        650,
      );
      const cross = createPathBuilder(X(-12), cyRow);
      cross.lineTo(X(12), cyRow);
      pushNet(
        cross,
        jd,
        650,
        [{ x: X(0), y: cyRow, type: "crystal", orientation: "h", at: 14 * s, scale: ps, ref: refdes("Y"), refDy: -14 }],
        900,
      );
    }
    // GND stitch.
    {
      const bb = createPathBuilder(X(24), Y(34));
      bb.lineTo(X(24), Y(52));
      pushNet(bb, jd, 420, [{ x: X(24), y: Y(52), type: "gndvia", at: 18 * s, scale: ps }], 500);
    }
    // Status LED leg off IO2.
    {
      const bb = createPathBuilder(X(66), y);
      bb.lineTo(X(66), Y(88));
      pushNet(
        bb,
        jd,
        1400,
        [
          { x: X(66), y: Y(28), type: "res", at: 28 * s, scale: ps, ref: refdes("R") },
          { x: X(66), y: Y(58), type: "led", at: 58 * s, scale: ps, ref: refdes("D"), refDx: 15 },
          { x: X(66), y: Y(88), type: "gndvia", at: 88 * s, scale: ps },
        ],
        (ledAt / bc.dist) * 1000,
      );
    }
    for (const lx of [-66, -14, 14, 32, 66]) {
      railColumns.push(X(lx));
    }
    addBox(X(-66), Y(-38), X(86), Y(88));
  };

  // ——— FPGA block: iCE40-style part with its config ecosystem — SPI flash
  // harness, oscillator into CLK, decoupling bank, CDONE indicator, and a
  // CRESET_B pull-up.
  const emitFpgaBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cx = pb.x + 96 * s;
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.25, s * 0.6);
    texts.push({ x: X(-12), y: Y(-52), text: refdes("U"), size: 11 });

    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-75), y);
    const decAt = bc.dist;
    bc.lineTo(X(55), y);
    bc.lineTo(X(80), y);
    const chain = pushNet(bc, jd, 1100, []);
    components.push({ x: X(0), y, type: "fpga", orientation: "v", dir: 1, triggerDist: jd, scale: s, branchIndex: chain, branchFrac: decAt / bc.dist });
    junctions.push({ x: X(-75), y, triggerDist: jd });

    // Decoupling bank: three caps in a row off VCCINT.
    {
      const bb = createPathBuilder(X(-75), y);
      bb.lineTo(X(-75), Y(58));
      pushNet(
        bb,
        jd,
        550,
        [
          { x: X(-75), y: Y(30), type: "capacitor", at: 30 * s, scale: ps, ref: refdes("C") },
          { x: X(-75), y: Y(58), type: "gndvia", at: 58 * s, scale: ps },
        ],
        (decAt / bc.dist) * 1100,
      );
    }
    for (let i = 0; i < 2; i += 1) {
      const lx = -30 + i * 22;
      const bb = createPathBuilder(X(lx), Y(44));
      bb.lineTo(X(lx), Y(80));
      pushNet(
        bb,
        jd,
        520 + i * 140,
        [
          { x: X(lx), y: Y(58), type: "capacitor", at: 14 * s, scale: ps, ref: refdes("C"), refDx: i === 0 ? -28 : 12 },
          { x: X(lx), y: Y(80), type: "gndvia", at: 36 * s, scale: ps },
        ],
        420 + i * 160,
      );
    }
    // Oscillator into CLK: out the pin then up so the can + wire are exposed
    // and light on reveal, instead of a hidden hop behind another net.
    {
      const bb = createPathBuilder(X(-63), Y(-30));
      bb.lineTo(X(-92), Y(-30));
      bb.lineTo(X(-92), Y(-64));
      pushNet(
        bb,
        jd,
        520,
        [{ x: X(-92), y: Y(-64), type: "oscbox", at: (29 + 34) * s, scale: ps, ref: refdes("X"), refDy: -14 }],
        700,
      );
    }
    // SPI config flash: 4-wire harness down to the flash package.
    {
      const flashY = Y(78);
      // Flash top-pin columns (symbol pins at -13.5,-4.5,4.5,13.5 * ps around X(21)).
      const flashPinX = (i: number) => X(21) + (-13.5 + i * 9) * ps;
      let firstHarness = -1;
      for (let i = 0; i < 4; i += 1) {
        const lx = 8 + i * 9;
        const bb = createPathBuilder(X(lx), Y(50));
        bb.lineTo(X(lx), flashY - 28 * ps);
        bb.lineTo(flashPinX(i), flashY - 28 * ps);
        bb.lineTo(flashPinX(i), flashY - 18 * ps);
        const hi = pushNet(bb, jd, 320, [], 360 + i * 60);
        if (i === 0) {
          firstHarness = hi;
        }
      }
      // Light the flash as the harness current arrives (first wire), not
      // after the whole bus fills.
      components.push({ x: X(21), y: flashY, type: "flash8", orientation: "v", dir: 1, triggerDist: jd, scale: ps, branchIndex: firstHarness, branchFrac: 0.85 });
      texts.push({ x: X(21) + 30 * ps * 0.5 + 6, y: flashY + 4, text: refdes("U"), size: 9 });
    }
    // CDONE → R + LED (config-done indicator).
    {
      const bb = createPathBuilder(X(55), Y(-24));
      bb.lineTo(X(84), Y(-24));
      bb.lineTo(X(84), Y(30));
      pushNet(
        bb,
        jd,
        1300,
        [
          { x: X(84), y: Y(-10), type: "res", at: (29 + 14) * s, scale: ps, ref: refdes("R") },
          { x: X(84), y: Y(12), type: "led", at: (29 + 36) * s, scale: ps, ref: refdes("D"), refDx: 15 },
          { x: X(84), y: Y(30), type: "gndvia", at: 999, scale: ps },
        ],
        1250,
      );
    }
    // CRESET_B pull-up.
    {
      const bb = createPathBuilder(X(55), Y(-38));
      bb.lineTo(X(70), Y(-38));
      bb.lineTo(X(70), Y(-58));
      pushNet(
        bb,
        jd,
        600,
        [{ x: X(70), y: Y(-50), type: "res", at: (15 + 12) * s, scale: ps, ref: refdes("R") }],
        1100,
      );
      junctions.push({ x: X(70), y: Y(-58), triggerDist: jd + 40 });
    }
    for (const lx of [-75, -30, -8, 8, 17, 26, 35, 84]) {
      railColumns.push(X(lx));
    }
    addBox(X(-104), Y(-72), X(84), Y(80));
  };

  // ——— 555 astable block: NE555 with the classic R→R→C timing ladder and
  // sense taps, CV cap, and a blinker LED on OUT.
  const emit555Block = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    const cx = pb.x + 72 * s;
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.25, s * 0.65);
    texts.push({ x: X(-8), y: Y(-40), text: refdes("U"), size: 11 });

    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-52), y);
    const tapAt = bc.dist;
    bc.lineTo(X(26), y);
    bc.lineTo(X(52), y);
    const outAt = bc.dist;
    bc.lineTo(X(72), y);
    const chain = pushNet(bc, jd, 950, []);
    components.push({ x: X(0), y, type: "timer555", orientation: "v", dir: 1, triggerDist: jd, scale: s, branchIndex: chain, branchFrac: tapAt / bc.dist });
    junctions.push({ x: X(-52), y, triggerDist: jd });
    junctions.push({ x: X(52), y, triggerDist: jd + 10 });

    // Timing ladder: R → node(DIS) → R → node(THR) → C → GND.
    {
      const bb = createPathBuilder(X(-52), y);
      bb.lineTo(X(-52), Y(92));
      pushNet(
        bb,
        jd,
        1500,
        [
          { x: X(-52), y: Y(20), type: "res", at: 20 * s, scale: ps, ref: refdes("R"), refDx: -26 },
          { x: X(-52), y: Y(48), type: "res", at: 48 * s, scale: ps, ref: refdes("R"), refDx: -26 },
          { x: X(-52), y: Y(74), type: "capacitor", at: 74 * s, scale: ps, ref: refdes("C"), refDx: -28 },
          { x: X(-52), y: Y(92), type: "gndvia", at: 92 * s, scale: ps },
        ],
        (tapAt / bc.dist) * 950,
      );
      junctions.push({ x: X(-52), y: Y(34), triggerDist: jd + 30 });
      junctions.push({ x: X(-52), y: Y(60), triggerDist: jd + 40 });
      // Sense taps into the bottom pins.
      const dis = createPathBuilder(X(-52), Y(34));
      dis.lineTo(X(-16), Y(34));
      dis.lineTo(X(-16), Y(30));
      pushNet(dis, jd, 380, [], 600);
      const thr = createPathBuilder(X(-52), Y(60));
      thr.lineTo(X(0), Y(60));
      thr.lineTo(X(0), Y(30));
      pushNet(thr, jd, 460, [], 700);
    }
    // CV cap.
    {
      const bb = createPathBuilder(X(16), Y(30));
      bb.lineTo(X(16), Y(64));
      pushNet(
        bb,
        jd,
        520,
        [
          { x: X(16), y: Y(46), type: "capacitor", at: 16 * s, scale: ps, ref: refdes("C") },
          { x: X(16), y: Y(64), type: "gndvia", at: 34 * s, scale: ps },
        ],
        800,
      );
    }
    // OUT → R → LED → GND: the blinker.
    {
      const bb = createPathBuilder(X(52), y);
      bb.lineTo(X(52), Y(84));
      pushNet(
        bb,
        jd,
        1200,
        [
          { x: X(52), y: Y(26), type: "res", at: 26 * s, scale: ps, ref: refdes("R") },
          { x: X(52), y: Y(54), type: "led", at: 54 * s, scale: ps, ref: refdes("D"), refDx: 15 },
          { x: X(52), y: Y(84), type: "gndvia", at: 84 * s, scale: ps },
        ],
        (outAt / bc.dist) * 950,
      );
    }
    for (const lx of [-52, -16, 0, 16, 52]) {
      railColumns.push(X(lx));
    }
    addBox(X(-52), Y(-40), X(72), Y(92));
  };

  const pb = createPathBuilder(between(LEFT_X + 10, busHi), 0);

  // Stage-appropriate hardware at a point on the bus.
  const placeStagePart = (x: number, y: number) => {
    if (stage === "input") {
      const type = inputQueue.shift();
      if (type) {
        components.push({ x, y, type, orientation: "v", dir: 1, triggerDist: pb.dist, scale: 1.5 });
        texts.push({ x: x + 15, y: y + 4, text: refdes(type === "fuse" ? "F" : "SW"), size: 9 });
      }
      return;
    }
    if (stage === "rail12") {
      emitShuntStub(x, y, "polcap");
      return;
    }
    if (stage === "rail33" || stage === "rail18") {
      emitShuntStub(x, y, "capacitor");
      return;
    }
    if (loadToggle++ % 2 === 0) {
      emitIndicatorStub(x, y, 1);
    } else {
      components.push({ x, y, type: "potentiometer", orientation: "v", dir: 1, triggerDist: pb.dist, scale: 1.5 });
      texts.push({ x: x + 18, y: y + 4, text: refdes("RV"), size: 9 });
    }
  };

  // A vertical bus leg with stage-appropriate parts and an occasional
  // inline filter element.
  const emitVerticalLeg = (yEnd: number) => {
    const x = pb.x;
    const legLength = yEnd - pb.y;
    if (legLength <= 0) {
      return;
    }

    const remaining = yEnd - pb.y;
    if (remaining > 150 && stage !== "input" && rand() < 0.55) {
      const inlineY = pb.y + remaining * between(0.1, 0.32);
      pb.lineTo(x, inlineY);
      const midY = inlineY + INLINE_SPAN / 2;
      if (stage === "load") {
        verticalResistor(pb, x);
        texts.push({ x: x + 14, y: midY, text: refdes("R"), size: 9 });
      } else {
        verticalInductor(pb, x, rand() < 0.5 ? -14 : 14);
        texts.push({ x: x + 18, y: midY, text: refdes("L"), size: 9 });
      }
    }

    for (let oy = pb.y + between(70, 150); oy < yEnd - 50; oy += between(170, 320)) {
      pb.lineTo(x, oy);
      placeStagePart(x, oy);
    }

    pb.lineTo(x, yEnd);
  };

  // Bus wanderer: mostly straight descent in the left band with small jogs.
  const emitWander = (yEnd: number) => {
    while (yEnd - pb.y > 280) {
      const legEnd = Math.min(pb.y + between(220, 420), yEnd - 60);
      emitVerticalLeg(legEnd);
      const toX = pickColumn(pb.x);
      if (Math.abs(toX - pb.x) >= 40) {
        vias.push({ x: pb.x, y: pb.y, triggerDist: pb.dist });
        // Only rail stages get shunt decoupling caps; never a bare stub
        // straight to a ground via (that shorts the live rail).
        if ((stage === "rail12" || stage === "rail33" || stage === "rail18") && rand() < 0.3) {
          emitShuntStub(pb.x, pb.y, stage === "rail12" ? "polcap" : "capacitor");
        }
        hopTo(toX, pb.y);
        vias.push({ x: toX, y: pb.y, triggerDist: pb.dist });
      }
    }
    emitVerticalLeg(yEnd);
  };

  const usableGaps = gaps.filter((gap) => gap.bottom - gap.top >= 70);

  // The chain starts at the mains.
  netFlags.push({ x: pb.x + 34, y: 8, text: "AC IN", triggerDist: 0 });

  usableGaps.forEach((gap, gapIndex) => {
    const gapDepth = gap.bottom - gap.top;
    const isLastGap = gapIndex === usableGaps.length - 1;
    const pending = centerpieceQueue[0];
    const crossY = gap.top + gapDepth * between(0.3, 0.5);

    emitWander(crossY);
    vias.push({ x: pb.x, y: crossY, triggerDist: pb.dist });

    // Available width to the right of the bus for a block — leaving the
    // reserved rail gutter clear so pass-through rails can dodge past.
    const avail = blockMaxX - pb.x - 40;
    if (pending === "rectifier" && avail >= 300) {
      const s = Math.min(2, Math.max(1.3, avail / 260));
      emitRectifierBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail12";
      // The trunk below the rectifier is now the +12V DC bus — the main line
      // that carries power down into the downstream ICs (not the AC input).
      netFlags.push({ x: pb.x + 22, y: crossY + 30, text: "+12V", triggerDist: pb.dist });
    } else if (pending === "buck" && avail >= 340) {
      const s = Math.min(3.2, Math.max(1.5, avail / 300));
      emitBuckBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail33";
      // Trunk stepped down to the +3V3 logic rail feeding the MCU/FPGA.
      netFlags.push({ x: pb.x + 22, y: crossY + 30, text: "+3V3", triggerDist: pb.dist });
    } else if (pending === "ldo" && avail >= 240) {
      const s = Math.min(2.4, Math.max(1.3, avail / 200));
      emitLdoBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail18";
      // Trunk stepped down to the +1V8 core rail.
      netFlags.push({ x: pb.x + 22, y: crossY + 30, text: "+1V8", triggerDist: pb.dist });
    } else if (pending === "mcu" && avail >= 300) {
      const s = Math.min(2.4, Math.max(1.3, avail / 220));
      emitMcuBlock(crossY, s);
      centerpieceQueue.shift();
    } else if (pending === "fpga" && avail >= 320) {
      const s = Math.min(2.2, Math.max(1.3, avail / 260));
      emitFpgaBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "load";
    } else if (pending === "timer555" && avail >= 260) {
      const s = Math.min(2.2, Math.max(1.3, avail / 200));
      emit555Block(crossY, s);
      centerpieceQueue.shift();
      stage = "load";
    } else if (stage === "load" && avail >= 160 && gap.bottom - crossY >= 60) {
      emitIndicatorStub(pb.x, crossY, 1);
    }

    if (isLastGap) {
      display = { x: rightX - 240, y: crossY + 12 };
    }

    // The bus simply keeps descending — no cross-page sweep.
    pb.lineTo(pb.x, Math.min(crossY + 24, gap.bottom));
  });

  emitWander(groundY);

  // Ground return: the bus visibly ends at a ground via.
  components.push({ x: pb.x, y: groundY + 18, type: "ground", orientation: "v", dir: 1, role: "shunt", triggerDist: pb.dist, scale: 1.7 });
  netFlags.push({ x: pb.x + 30, y: groundY - 4, text: "GND", triggerDist: pb.dist });

  // Now that every IC keep-out box exists, route the pass-through rails so
  // each dodges clear of the ICs and they all converge into the ground bus.
  buildAllRails();

  // Ambient dormant network: decorative Manhattan squiggles with pads that
  // fill the rest of the page so the whole layout reads as a PCB. They avoid
  // the schematic symbols and the readout so they don't muddle the circuit.
  const obstacles: Array<{ x1: number; y1: number; x2: number; y2: number }> = components.map((c) => {
    // Fan-out blocks reserve room for their whole sub-circuit spread.
    const hx =
      (c.type === "buck"
        ? 200
        : c.type === "fpga"
          ? 150
          : c.type === "mcu"
            ? 110
            : c.type === "timer555"
              ? 100
              : c.type === "ldo"
                ? 80
                : BODY_HALF[c.type] + 14) * c.scale;
    const hy =
      (c.type === "rectifier"
        ? 40
        : c.type === "buck"
          ? 110
          : c.type === "fpga"
            ? 100
            : c.type === "mcu" || c.type === "timer555"
              ? 100
              : c.type === "ldo"
                ? 60
                : BODY_HALF[c.type] + 14) * c.scale;
    return { x1: c.x - hx, y1: c.y - hy, x2: c.x + hx, y2: c.y + hy };
  });
  for (const flag of netFlags) {
    obstacles.push({ x1: flag.x - 34, y1: flag.y - 12, x2: flag.x + 34, y2: flag.y + 18 });
  }
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
      for (let sgi = 0; sgi < segments; sgi += 1) {
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

  // Build the descent reparametrization from the bus samples. The metric
  // grows with vertical travel (full weight) plus a light share of
  // horizontal travel, so mapping scroll linearly onto the metric makes the
  // lit front descend at a constant on-screen speed.
  const H_WEIGHT = 0.16;
  const samples = pb.samples;
  const descent: Array<{ metric: number; dist: number }> = [{ metric: 0, dist: 0 }];
  let metric = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dy = Math.max(0, samples[i].y - samples[i - 1].y);
    const dx = Math.abs(samples[i].x - samples[i - 1].x);
    metric += dy + H_WEIGHT * dx;
    descent.push({ metric, dist: samples[i].dist });
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
    descent,
    totalMetric: metric,
    texts,
    netFlags,
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Schematic symbols, drawn for vertical flow (+y); rotated -90° for horizontal.
function symbolFor(type: OverlayType, sub: string[] = []): ReactNode {
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
          <line x1="0" y1="-8" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="8" r="2" fill="currentColor" />
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
          {/* Through-pins along the wire axis so the series current lands on
              real pins (top/bottom center), not the bare package body. */}
          <line x1="0" y1="-16" x2="0" y2="-13" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="13" x2="0" y2="16" stroke="currentColor" strokeWidth="1.5" />
          {/* Decorative side pins */}
          <line x1="-14" y1="-8" x2="-10" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="8" x2="-10" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="-8" x2="14" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-10" y="-13" width="20" height="26" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-6" cy="-9" r="1.5" fill="currentColor" />
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
          {/* Primary terminals (-68,±14) are fed by two bus leads drawn in emit */}
          {/* Transformer: primary (left) + secondary (right) windings, core between */}
          <path d="M-68 -14 Q-61 -10 -68 -6 Q-61 -2 -68 2 Q-61 6 -68 10 Q-61 14 -68 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M-48 -14 Q-55 -10 -48 -6 Q-55 -2 -48 2 Q-55 6 -48 10 Q-55 14 -48 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <line x1="-59" y1="-14" x2="-59" y2="14" stroke="currentColor" strokeWidth="1.1" />
          <line x1="-57" y1="-14" x2="-57" y2="14" stroke="currentColor" strokeWidth="1.1" />
          {/* Secondary: two leads routed up/down to the bridge top/bottom nodes,
              clear of the diodes */}
          <line x1="-48" y1="-14" x2="-48" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="-20" x2="-10" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="14" x2="-48" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="20" x2="-10" y2="20" stroke="currentColor" strokeWidth="1.5" />
          {/* Diode bridge diamond */}
          <line x1="-34" y1="0" x2="-10" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="-20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-34" y1="0" x2="-10" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {[
            // T→R and B→R point into DC+ (right); L→T and L→B point out of DC- (left)
            { x: 2, y: -10, angle: 40 },
            { x: 2, y: 10, angle: -40 },
            { x: -22, y: -10, angle: -40 },
            { x: -22, y: 10, angle: 40 },
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
          {/* DC- return from the left node down to ground */}
          <line x1="-34" y1="0" x2="-34" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-40" y1="10" x2="-28" y2="10" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-37" y1="13" x2="-31" y2="13" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-35" y1="16" x2="-33" y2="16" stroke="currentColor" strokeWidth="1.8" />
          {/* DC+ rail */}
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
          {/* Internal reference designators */}
          <text x="-66" y="-16" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[0] ?? "T1"}
          </text>
          <text x="43" y="12" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[1] ?? "C?"}
          </text>
          <text x="65" y="10" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[2] ?? "R?"}
          </text>
        </>
      );
    case "buck":
      // TPS54331-style switcher symbol, recreated from the datasheet: a
      // rectangular body with named pins. The surrounding sub-circuits are
      // emitted as real animated branches by emitBuckBlock.
      return (
        <>
          {/* Pin stubs — left: BOOT, VIN, EN; right: PH, VSENSE; bottom: SS, GND, COMP */}
          <line x1="-38" y1="-14" x2="-30" y2="-14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-38" y1="0" x2="-30" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-38" y1="14" x2="-30" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="0" x2="38" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="22" x2="-14" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="22" x2="0" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="14" y1="22" x2="14" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-30" y="-22" width="60" height="44" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-25" cy="-17" r="1.4" fill="currentColor" />
          {/* Pin names */}
          <text x="-27" y="-12" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">BOOT</text>
          <text x="-27" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VIN</text>
          <text x="-27" y="16" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">EN</text>
          <text x="27" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">PH</text>
          <text x="27" y="16" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VSENSE</text>
          <text x="-14" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">SS</text>
          <text x="0" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="14" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">COMP</text>
          {/* Part number */}
          <text x="0" y="-4" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="currentColor">
            TPS54331
          </text>
        </>
      );
    case "mcu":
      // ESP32-S3-style module symbol with named pins; support circuitry is
      // emitted as animated branches by emitMcuBlock.
      return (
        <>
          {/* Pin stubs — left: EN, 3V3, IO0; right: TXD0, IO2, RXD0; bottom: XP, XN, GND */}
          <line x1="-43" y1="-16" x2="-35" y2="-16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-43" y1="0" x2="-35" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-43" y1="16" x2="-35" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="-16" x2="43" y2="-16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="0" x2="43" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="16" x2="43" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-12" y1="28" x2="-12" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="28" x2="12" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <line x1="24" y1="28" x2="24" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-35" y="-28" width="70" height="56" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-29" cy="-22" r="1.4" fill="currentColor" />
          {/* Pin names */}
          <text x="-32" y="-14" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">EN</text>
          <text x="-32" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">3V3</text>
          <text x="-32" y="18" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IO0</text>
          <text x="32" y="-14" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">TXD0</text>
          <text x="32" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IO2</text>
          <text x="32" y="18" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">RXD0</text>
          <text x="-12" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">XP</text>
          <text x="12" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">XN</text>
          <text x="24" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          {/* Part number */}
          <text x="0" y="-2" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor">
            ESP32-S3
          </text>
          <text x="0" y="8" textAnchor="middle" fontSize="4.5" fontFamily="monospace" fill="currentColor" opacity="0.7">
            WROOM-1
          </text>
        </>
      );
    case "ldo":
      // AMS1117-style 3-pin linear regulator.
      return (
        <>
          <line x1="-32" y1="0" x2="-24" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="24" y1="0" x2="32" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="16" x2="0" y2="22" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-24" y="-16" width="48" height="32" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <text x="-21" y="3" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VIN</text>
          <text x="21" y="3" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VOUT</text>
          <text x="0" y="13" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="0" y="-5" textAnchor="middle" fontSize="5.2" fontFamily="monospace" fill="currentColor">
            AMS1117
          </text>
          <text x="0" y="2" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.7">
            -1.8
          </text>
        </>
      );
    case "fpga":
      // iCE40-style FPGA package with banked pin names.
      return (
        <>
          {/* Left pins: CLK, VCCINT, IOL */}
          <line x1="-63" y1="-30" x2="-55" y2="-30" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-63" y1="0" x2="-55" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-63" y1="18" x2="-55" y2="18" stroke="currentColor" strokeWidth="1.5" />
          {/* Right pins: CRESET_B, CDONE, IOB */}
          <line x1="55" y1="-38" x2="63" y2="-38" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="-24" x2="63" y2="-24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="0" x2="63" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="18" x2="63" y2="18" stroke="currentColor" strokeWidth="1.5" />
          {/* Bottom pins: decoupling + SPI bank */}
          <line x1="-30" y1="44" x2="-30" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="44" x2="-8" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="44" x2="8" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="17" y1="44" x2="17" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="26" y1="44" x2="26" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="44" x2="35" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-55" y="-44" width="110" height="88" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-48" cy="-37" r="1.6" fill="currentColor" />
          <text x="-51" y="-28" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CLK</text>
          <text x="-51" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VCCINT</text>
          <text x="-51" y="20" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOL</text>
          <text x="51" y="-36" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CRESET_B</text>
          <text x="51" y="-22" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CDONE</text>
          <text x="51" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOB</text>
          <text x="51" y="20" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOB</text>
          <text x="-30" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">VCC</text>
          <text x="-8" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="8" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SS</text>
          <text x="17" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SCK</text>
          <text x="26" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SI</text>
          <text x="35" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SO</text>
          <text x="0" y="-6" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="currentColor">
            iCE40UP5K
          </text>
          <text x="0" y="6" textAnchor="middle" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            FPGA
          </text>
        </>
      );
    case "timer555":
      // NE555 in its classic astable dress.
      return (
        <>
          <line x1="-34" y1="0" x2="-26" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="26" y1="0" x2="34" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-16" y1="30" x2="-16" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="30" x2="0" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="16" y1="30" x2="16" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="16" y1="-30" x2="16" y2="-36" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-26" y="-30" width="52" height="60" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-20" cy="-24" r="1.5" fill="currentColor" />
          <text x="-23" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VCC</text>
          <text x="23" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">OUT</text>
          <text x="-16" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">DIS</text>
          <text x="0" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">THR</text>
          <text x="16" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">CV</text>
          <text x="16" y="-24" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">RST</text>
          <text x="0" y="-8" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor">
            NE555
          </text>
        </>
      );
    case "flash8":
      // SPI configuration flash.
      return (
        <>
          <line x1="-13.5" y1="-18" x2="-13.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-4.5" y1="-18" x2="-4.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="4.5" y1="-18" x2="4.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="13.5" y1="-18" x2="13.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-19" y="-12" width="38" height="24" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="-14" cy="-7" r="1.3" fill="currentColor" />
          <text x="0" y="1" textAnchor="middle" fontSize="5" fontFamily="monospace" fill="currentColor">
            W25Q32
          </text>
          <text x="0" y="8" textAnchor="middle" fontSize="3.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            SPI FLASH
          </text>
        </>
      );
    case "oscbox":
      // Canned oscillator.
      return (
        <>
          <line x1="12" y1="0" x2="18" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-12" y="-10" width="24" height="20" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.6" />
          <text x="0" y="-1" textAnchor="middle" fontSize="4.6" fontFamily="monospace" fill="currentColor">
            12MHz
          </text>
          <text x="0" y="6" textAnchor="middle" fontSize="3.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            OSC
          </text>
        </>
      );
    case "res":
      // Standalone zig-zag resistor for branch sub-circuits.
      return (
        <path
          d="M0 -10 L0 -8 L5 -6 L-5 -2 L5 2 L-5 6 L0 8 L0 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      );
    case "gndvia":
      // Ground via: a plated through-hole pad (ring + filled center).
      return (
        <>
          <circle cx="0" cy="0" r="4.5" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="1.6" fill="currentColor" />
        </>
      );
    case "testpoint":
      return (
        <>
          <line x1="0" y1="-14" x2="0" y2="-4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
  const netFlagRefs = useRef<Array<SVGGElement | null>>([]);
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

    // Invert the descent table: metric -> analytic path distance.
    const descent = geometry.descent;
    const distanceForMetric = (m: number): number => {
      if (descent.length === 0) {
        return 0;
      }
      if (m <= descent[0].metric) {
        return descent[0].dist;
      }
      const last = descent[descent.length - 1];
      if (m >= last.metric) {
        return last.dist;
      }
      let lo = 0;
      let hi = descent.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (descent[mid].metric <= m) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const a = descent[lo];
      const b = descent[hi];
      const t = (m - a.metric) / Math.max(1e-6, b.metric - a.metric);
      return a.dist + t * (b.dist - a.dist);
    };

    // Scroll maps linearly onto the descent metric, then to analytic distance,
    // then scaled into the DOM-measured length the dash offset expects.
    const targetDistance = () => {
      const containerScrolls = container.scrollHeight > container.clientHeight + 4;
      const scrollTop = containerScrolls ? container.scrollTop : window.scrollY;
      const maxScroll = containerScrolls
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
      const analytic = distanceForMetric(progress * geometry.totalMetric);
      return analytic * (totalLengthRef.current / Math.max(1, geometry.totalLength));
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
    const prevFlag: boolean[] = new Array(geometry.netFlags.length).fill(false);
    const branchT: number[] = new Array(geometry.branches.length).fill(0);
    const branchStart: number[] = new Array(geometry.branches.length).fill(Number.NaN);
    const prevBranchT: number[] = new Array(geometry.branches.length).fill(-1);

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
      // The reveal tracks the scroll target directly — the front's speed now
      // equals the scroll speed (constant descent), with no proportional lerp
      // that would make it accelerate to "catch up." A generous constant-
      // velocity cap only smooths huge single-frame jumps (fling / anchor
      // jumps) without reintroducing acceleration within a normal scroll.
      const maxStep = dt * 6;
      const diff = target - shown;
      if (Math.abs(diff) <= maxStep) {
        shown = target;
      } else {
        shown += Math.sign(diff) * maxStep;
      }

      // Analytic distance for triggers (branch fills, component lighting).
      const trigDist = (shown / Math.max(1, realLength)) * geometry.totalLength;
      let timedActive = false;

      if (shown !== prevShown) {
        const offset = `${realLength - shown}`;
        litPath.style.strokeDashoffset = offset;
        const glow = litGlowRef.current;
        if (glow) {
          glow.style.strokeDashoffset = offset;
        }

        const point = litPath.getPointAtLength(shown);
        bolt.setAttribute("transform", `translate(${point.x} ${point.y})`);

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

      // Branch fills: scroll-coupled branches follow the front; timed
      // branches run their own power-on clock (per-pin speeds) once the
      // front passes their junction, and de-energize on scroll-back.
      for (let i = 0; i < geometry.branches.length; i += 1) {
        const branch = geometry.branches[i];
        const lit = branchLitRefs.current[i];
        const branchGlow = branchGlowRefs.current[i];
        const miniBolt = branchBoltRefs.current[i];
        const branchLength = branchLengthsRef.current[i] ?? 0;
        if (!lit || branchLength <= 0) {
          continue;
        }
        let t: number;
        if (branch.duration) {
          if (trigDist + 1 >= branch.junctionDist) {
            if (Number.isNaN(branchStart[i])) {
              branchStart[i] = now;
            }
            t = Math.min(1, Math.max(0, (now - branchStart[i] - (branch.delay ?? 0)) / branch.duration));
            if (t < 1) {
              timedActive = true;
            }
          } else {
            branchStart[i] = Number.NaN;
            t = 0;
          }
        } else {
          t = Math.min(1, Math.max(0, (trigDist - branch.junctionDist) / branch.fillWindow));
        }
        branchT[i] = t;
        if (t === prevBranchT[i]) {
          continue;
        }
        prevBranchT[i] = t;
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
      // their lit state actually flips. Parts on timed branches follow their
      // net's fill clock instead of the main trigger distance.
      for (let i = 0; i < geometry.components.length; i += 1) {
        const group = componentRefs.current[i];
        if (!group) {
          continue;
        }
        const comp = geometry.components[i];
        const passed =
          comp.branchIndex != null
            ? branchT[comp.branchIndex] + 0.001 >= (comp.branchFrac ?? 1)
            : comp.triggerDist <= trigDist + 1;
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

      for (let i = 0; i < geometry.netFlags.length; i += 1) {
        const flag = netFlagRefs.current[i];
        if (!flag) {
          continue;
        }
        const passed = geometry.netFlags[i].triggerDist <= trigDist + 1;
        if (passed !== prevFlag[i]) {
          prevFlag[i] = passed;
          flag.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
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

      const moving = shown !== target || shown !== prevShown || timedActive;
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
            component.orientation === "h"
              ? ` rotate(${component.dir < 0 ? 90 : -90})`
              : component.dir < 0
                ? " rotate(180)"
                : ""
          } scale(${component.scale})`}
        >
          {/* Occluder: hides the wire (and its glow/flow dashes) under the
              symbol body so the trace reads as wired through the part. In
              local coords the wire always runs along +y, except the
              horizontal composites (rectifier, buck, mcu). */}
          {component.type === "ground" ||
          component.type === "testpoint" ||
          component.type === "gndvia" ||
          component.type === "flash8" ||
          component.type === "oscbox" ? null : component.type === "rectifier" ||
            component.type === "buck" ||
            component.type === "mcu" ||
            component.type === "ldo" ||
            component.type === "fpga" ||
            component.type === "timer555" ? (
            <rect
              x={-BODY_HALF[component.type]}
              y={-8}
              width={BODY_HALF[component.type] * 2}
              height={16}
              fill="var(--background)"
            />
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
            {symbolFor(component.type, component.labels)}
          </g>
        </g>
      ))}

      {/* Silkscreen: reference designators (static, muted) */}
      {geometry.texts.map((t, index) => (
        <text
          key={`ref-${index}`}
          x={t.x}
          y={t.y}
          fontSize={t.size}
          fontFamily="monospace"
          fill="var(--text-muted)"
          opacity="0.9"
          paintOrder="stroke"
          stroke="var(--background)"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {t.text}
        </text>
      ))}

      {/* Net-name flags (AC IN, +12V, +3V3, GND): light as the current passes */}
      {geometry.netFlags.map((flag, index) => (
        <g
          key={`net-${index}`}
          ref={(el) => {
            netFlagRefs.current[index] = el;
          }}
          transform={`translate(${flag.x} ${flag.y})`}
          style={{ color: "var(--outline-strong)", transition: "color 0.3s ease" }}
        >
          <path d="M0 12 L-5 4 L5 4 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <text x="0" y="0" textAnchor="middle" fontSize="11" fontFamily="monospace" fill="currentColor">
            {flag.text}
          </text>
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
