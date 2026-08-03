// Pure coordinate-math helpers extracted from CircuitTrace.tsx: no React
// hooks, no refs, no DOM reads. Every function here is a function of its own
// parameters (plus the deterministic PRNG they create), producing a
// TraceGeometry the component then renders and animates.
import {
  BODY_HALF,
  INLINE_SPAN,
  LEFT_X,
  NET_TAG_HALF_H,
  NET_TAG_NOTCH,
  NET_TAG_PAD,
  type Branch,
  type Marker,
  type OverlayComponent,
  type OverlayType,
  type TraceGeometry,
} from "./CircuitTrace.constants";

// Monospace advance is ~0.6em; text renders at fontSize 11.
export const netTagBodyWidth = (text: string) => text.length * 6.6 + NET_TAG_PAD * 2;
export const netTagSpan = (text: string) => NET_TAG_NOTCH + netTagBodyWidth(text);

// Deterministic PRNG so the route is stable for a given layout (no flicker on
// re-measure) but varies across page sizes.
export function mulberry32(seed: number) {
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
export function quadLength(x0: number, y0: number, qx: number, qy: number, x1: number, y1: number): number {
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
export function createPathBuilder(startX: number, startY: number) {
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

export type PathBuilder = ReturnType<typeof createPathBuilder>;

// Inline geometry: the wire itself becomes the component.
export function verticalResistor(pb: PathBuilder, x: number) {
  const amp = 7;
  let y = pb.y;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    y += 8;
    pb.lineTo(x + offset, y);
  }
}

export function verticalInductor(pb: PathBuilder, x: number, bow: number) {
  let y = pb.y;
  for (let i = 0; i < 4; i += 1) {
    pb.quadTo(x + bow, y + 6, x, y + 12);
    y += 12;
  }
}

export function horizontalResistor(pb: PathBuilder, y: number, dir: number) {
  const amp = 7;
  let x = pb.x;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    x += 8 * dir;
    pb.lineTo(x, y + offset);
  }
}

export function horizontalInductor(pb: PathBuilder, y: number, dir: number) {
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
export function buildTrace(width: number, height: number, gaps: Array<{ top: number; bottom: number }>): TraceGeometry {
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
  // moves JUMP over these with the classic schematic crossover arc — but only
  // where the claimed wire actually exists, hence the y-extent: a claim is a
  // real vertical segment (x, y1 → y2), not an infinite column, so a run
  // hundreds of px above or below it draws no phantom hop.
  const railColumns: Array<{ x: number; y1: number; y2: number }> = [];
  const claimColumn = (x: number, ya: number, yb: number) => {
    railColumns.push({ x, y1: Math.min(ya, yb), y2: Math.max(ya, yb) });
  };
  // Tolerance for "the run is on this wire's span" (px).
  const HOP_Y_TOL = 2;

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
      .filter(
        (c) =>
          (c.x - pb.x) * dir > 14 &&
          (toX - c.x) * dir > 14 &&
          y >= c.y1 - HOP_Y_TOL &&
          y <= c.y2 + HOP_Y_TOL,
      )
      .map((c) => c.x)
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
      if (Math.abs(c - cur) >= 44 && railColumns.every((r) => Math.abs(r.x - c) > 30)) {
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
    // Reserve the branch column so no descending bus/rail runs over its parts —
    // only over the vertical leg that actually exists (y → the ground pad).
    if (bx !== x) {
      claimColumn(bx, y, ledY + 17);
    }
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
    // Home columns claimed by already-routed rails. Like `railColumns`, each
    // lane records the y-intervals where it actually descends in that column
    // (a rail only occupies its home column in the clear gaps between chips
    // and on the final run to ground — everywhere else it rides the gutter),
    // so a later rail only hops where a wire genuinely crosses.
    const railLanes: Array<{ x: number; spans: Array<[number, number]> }> = [];
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
        while (railLanes.some((l) => Math.abs(l.x - homeX) < 40) && guard++ < 12) {
          homeX += 46;
          if (homeX > homeHi) {
            homeX = homeLo + (homeX - homeHi);
          }
        }
        const lane: { x: number; spans: Array<[number, number]> } = { x: homeX, spans: [] };
        railLanes.push(lane);
        // Dodge lane in the reserved gutter, clear of every keep-out box.
        const dodgeX = Math.min(rightX - 14, rightX - 14 - (k % 3) * 20);

        const parts: Array<{ x: number; y: number; type: OverlayType; at: number }> = [];
        const bb = createPathBuilder(req.fromX, fy);
        junctions.push({ x: req.fromX, y: fy, triggerDist: jd });

        // Horizontal run inward that hops other rails' home columns.
        const runTo = (toX: number, atY: number) => {
          const d = toX > bb.x ? 1 : -1;
          for (const r of railLanes
            .filter(
              (l) =>
                l !== lane &&
                (l.x - bb.x) * d > 14 &&
                (toX - l.x) * d > 14 &&
                l.spans.some(([a, b]) => atY >= a - HOP_Y_TOL && atY <= b + HOP_Y_TOL),
            )
            .map((l) => l.x)
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
            // This is the only stretch of home column this rail occupies here.
            lane.spans.push([backY, midY]);
            if (bi + 1 < boxes.length) {
              runTo(dodgeX, midY);
            }
          }
        }

        // 3. Final descent in the home column to the ground collector.
        if (Math.abs(bb.x - homeX) > 2) {
          runTo(homeX, bb.y);
        }
        const descentTop = bb.y;
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
        lane.spans.push([descentTop, groundY]);

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
    // Anchored on the rectifier's +12V output node (the far end of `bc`).
    netFlags.push({ x: cxc + 100 * s, y, text: "+12V", triggerDist: jd, side: "right" });
    addBox(pb.x, y - 44 * s, cxc + 100 * s, y + 44 * s);
    // No pass-through rail here: the +12V DC output is not shunted down the right
    // gutter. Instead the caller threads the main spine out of this node so the
    // descending bus below the rectifier IS the +12V line into the downstream ICs.
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
    // Zener clamp: anode at ground, cathode at the PH node. In breakdown the
    // clamp legitimately conducts into the cathode. The net is authored FROM
    // the PH tap OUTWARD to the via — the reveal always draws start→end, so
    // this keeps current visibly flowing PH → zener → via and the via (now
    // at the path's far end) only lights once the fill actually reaches it,
    // instead of appearing to source current back up toward the diode.
    {
      const bb = createPathBuilder(X(44), y);
      bb.lineTo(X(44), Y(64));
      pushNet(
        bb,
        jd,
        720,
        [
          { x: X(44), y: Y(32), type: "zener", dir: -1, at: 32 * s, scale: ps, ref: refdes("D") },
          { x: X(44), y: Y(64), type: "gndvia", at: 64 * s, scale: ps },
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
      tap.lineTo(X(48), Y(14));
      tap.quadTo(X(44), Y(14) - 8, X(40), Y(14)); // hop over the zener/via leg — not connected
      tap.lineTo(X(38), Y(14));
      pushNet(tap, jd, 1800, [], 1500);
    }

    // Anchored on the buck output node at X(176), y (the block's right edge).
    netFlags.push({ x: X(176), y, text: "+3V3", triggerDist: jd, side: "right" });
    // Claimed columns must coincide with a vertical net this block actually
    // emitted, with that net's real y-span — otherwise later horizontal runs
    // hop over nothing.
    for (const [lx, ly1, ly2] of [
      [-44, 52, 88], // SS soft-start cap leg
      [-14, 28, 52], // SS pin drop
      [0, 22, 48], // GND stitch
      [14, 28, 96], // COMP RC ladder
      [44, -64, 64], // PH node: bootstrap return + zener clamp
      [122, 0, 72], // output ceramic
      [148, 0, 72], // output bulk
      [176, 0, 96], // FB divider
    ] as const) {
      claimColumn(X(lx), Y(ly1), Y(ly2));
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
    // Anchored on the free end of the test point's stub (drawn from y-14 to
    // y-4 at scale `ps`), so the tag clears the test-point ring.
    netFlags.push({ x: X(92), y: y - 14 * ps, text: "+1V8", triggerDist: jd, side: "right" });
    for (const [lx, ly1, ly2] of [
      [-36, 0, 52], // Cin leg
      [0, 16, 40], // GND stitch
      [64, 0, 52], // Cout leg
    ] as const) {
      claimColumn(X(lx), Y(ly1), Y(ly2));
    }
    addBox(X(-36), Y(-30), X(92), Y(52));
  };

  // ——— MCU block: ESP32-S3 module with support circuitry on staggered
  // power-on clocks — decoupling, EN pull-up, crystal + load caps, status LED.
  const emitMcuBlock = (y: number, s: number) => {
    const jd = pb.dist;
    junctions.push({ x: pb.x, y, triggerDist: jd });
    // The bus above this block is already routed by the time we get here, and
    // it wanders anywhere in the left band — its last jog corner (plus the via
    // and glow that sit on it) can land right over where the package would go,
    // so the trunk reads as running behind the chip's top-left. Measure the
    // trunk we've already drawn and slide the package right until its body
    // clears that column, bounded by the reserved rail gutter.
    const PKG_CLEAR = 24;
    let cx = pb.x + 82 * s;
    {
      const bandTop = y - 28 * s - PKG_CLEAR;
      const bandBottom = y + 28 * s + PKG_CLEAR;
      let trunkRight = -Infinity;
      const trail = pb.samples;
      for (let i = 1; i < trail.length; i += 1) {
        const a = trail[i - 1];
        const b = trail[i];
        // Any already-drawn trunk segment that lives in the package's band.
        if (Math.max(a.y, b.y) < bandTop || Math.min(a.y, b.y) > bandBottom) {
          continue;
        }
        trunkRight = Math.max(trunkRight, a.x, b.x);
      }
      const need = trunkRight + PKG_CLEAR - (cx - 35 * s);
      const room = blockMaxX - (cx + 86 * s);
      if (need > 0 && room > 0) {
        cx += Math.min(need, room);
      }
    }
    const X = (lx: number) => cx + lx * s;
    const Y = (ly: number) => y + ly * s;
    const ps = Math.max(1.25, s * 0.6);
    texts.push({ x: X(-10), y: Y(-38), text: refdes("U"), size: 11 });

    const bc = createPathBuilder(pb.x, y);
    bc.lineTo(X(-66), y);
    const decAt = bc.dist;
    // Explicit vertices on the symbol's pin-stub ends (local ±43) so the spine
    // visibly lands on the 3V3 pin on the left and leaves on IO2 on the right,
    // instead of only being inferred from a single run straight under the body.
    bc.lineTo(X(-43), y);
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
    // Real vertical nets of this block only: the decoupling/EN column, the two
    // crystal legs, the GND stitch and the status-LED leg.
    for (const [lx, ly1, ly2] of [
      [-66, -16, 56], // EN pull-up rise + decoupling drop
      [-12, 34, 78], // XP crystal leg
      [12, 34, 78], // XN crystal leg
      [24, 34, 52], // GND stitch
      [66, 0, 88], // status LED leg
    ] as const) {
      claimColumn(X(lx), Y(ly1), Y(ly2));
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
    for (const [lx, ly1, ly2] of [
      [-75, 0, 58], // VCCINT decoupling
      [-30, 44, 80], // decoupling bank cap 1
      [-8, 44, 80], // decoupling bank cap 2
      [84, -24, 30], // CDONE indicator leg
    ] as const) {
      claimColumn(X(lx), Y(ly1), Y(ly2));
    }
    // SPI harness drops: Y(50) down to the flash's top-pin row.
    for (let i = 0; i < 4; i += 1) {
      claimColumn(X(8 + i * 9), Y(50), Y(78) - 28 * ps);
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
    for (const [lx, ly1, ly2] of [
      [-52, 0, 92], // timing ladder
      [-16, 30, 34], // DIS sense stub
      [0, 30, 60], // THR sense stub
      [16, 30, 64], // CV cap
      [52, 0, 84], // OUT blinker leg
    ] as const) {
      claimColumn(X(lx), Y(ly1), Y(ly2));
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

  // The chain starts at the mains. Anchored on the trunk column itself (the
  // bus descends from y = 0 at x = pb.x); the tag body extends right, clear
  // of the wire.
  netFlags.push({ x: pb.x, y: 14, text: "AC IN", triggerDist: 0, side: "right" });

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
      // AC arrives here (pb at the transformer-primary node) and is converted.
      const busX = pb.x; // left-band column the DC bus resumes in
      const dcPlusX = pb.x + 200 * s; // rectifier +12V output node (= cxc + 100*s)
      const dcBusY = crossY + 52 * s; // below the block body + its ground shunts
      emitRectifierBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail12";
      // Thread the continuous spine THROUGH the rectifier: the horizontal run at
      // crossY is hidden under the block's background occluder, so the wire reads
      // as AC-in on the left and +12V-out on the right. The DC output then sweeps
      // back to the bus column and becomes the main line down into the ICs — no
      // AC wire bypasses the rectifier, and the +12V no longer dangles off-page.
      pb.lineTo(dcPlusX, crossY); // through the converter → emerge as +12V (right)
      pb.lineTo(dcPlusX, dcBusY); // drop clear of the block on the right
      pb.lineTo(busX, dcBusY); // +12V bus returns to the left band, now the spine
      // The trunk below the rectifier is the +12V DC bus feeding the downstream ICs.
      // Anchored on the corner where the DC return lands back in the bus column.
      netFlags.push({ x: busX, y: dcBusY, text: "+12V", triggerDist: pb.dist, side: "right" });
    } else if (pending === "buck" && avail >= 340) {
      const s = Math.min(3.2, Math.max(1.5, avail / 300));
      emitBuckBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail33";
      // Trunk stepped down to the +3V3 logic rail feeding the MCU/FPGA.
    } else if (pending === "ldo" && avail >= 240) {
      const s = Math.min(2.4, Math.max(1.3, avail / 200));
      emitLdoBlock(crossY, s);
      centerpieceQueue.shift();
      stage = "rail18";
      // Trunk stepped down to the +1V8 core rail.
      // Anchored on the trunk just below the block (the bus always runs from
      // crossY down to at least crossY + 24 in this column).
      netFlags.push({ x: pb.x, y: crossY + 20, text: "+1V8", triggerDist: pb.dist, side: "right" });
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

    // The bus simply keeps descending — no cross-page sweep. Clamp to pb.y so the
    // rectifier case (whose +12V return already dropped the spine below crossY)
    // never draws a backwards, upward segment.
    pb.lineTo(pb.x, Math.max(pb.y, Math.min(crossY + 24, gap.bottom)));
  });

  emitWander(groundY);

  // Ground return: the bus visibly ends at a ground via.
  components.push({ x: pb.x, y: groundY + 18, type: "ground", orientation: "v", dir: 1, role: "shunt", triggerDist: pb.dist, scale: 1.7 });
  // Anchored on the trunk just above the ground symbol's stem.
  netFlags.push({ x: pb.x, y: groundY - 4, text: "GND", triggerDist: pb.dist, side: "right" });

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
    // Cover the rendered tag: the anchor point plus the body extending to
    // whichever side it was placed on, with a small margin.
    const span = netTagSpan(flag.text);
    obstacles.push({
      x1: flag.x - (flag.side === "left" ? span + 6 : 6),
      y1: flag.y - NET_TAG_HALF_H - 6,
      x2: flag.x + (flag.side === "right" ? span + 6 : 6),
      y2: flag.y + NET_TAG_HALF_H + 6,
    });
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
