// Pure constants and type declarations extracted from CircuitTrace.tsx.
// No React hooks, refs, or DOM reads live here — see CircuitTrace.tsx for
// the stateful component and CircuitTrace.geometry.ts for the pure
// coordinate-math helpers that consume these.

export type OverlayType =
  | "led"
  | "capacitor"
  | "diode"
  | "zener"
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

export interface OverlayComponent {
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

export interface Branch {
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

export interface Marker {
  x: number;
  y: number;
  triggerDist: number;
}

export interface TraceGeometry {
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
  // `x`/`y` is the ANCHOR: the exact point on the wire/node being annotated.
  // The tag body (a schematic net-label pentagon whose point sits on the
  // anchor) extends away from it in the `side` direction.
  netFlags: Array<{ x: number; y: number; text: string; triggerDist: number; side: "left" | "right" }>;
}

// Net-label tag geometry, shared by the keep-out boxes and the renderer.
export const NET_TAG_HALF_H = 9;
export const NET_TAG_NOTCH = 7; // depth of the pointed nose, anchor → body edge
export const NET_TAG_PAD = 8; // horizontal padding either side of the text

export const LEFT_X = 22;
export const MAX_BRANCHES = 8;
// Parts are placed by power-chain stage (see buildTrace), not by cosmetic
// cycles: the whole page reads as one AC→DC system — AC input → fuse/switch
// → bridge rectifier → +12V rail → buck converter → +3V3 rail → MCU →
// loads/indicators → ground return.

// Half-extent of each symbol body along the wire axis (unscaled). Each
// component paints a background-colored occluder over this span so the wire
// doesn't show through the symbol. (The path itself must stay one continuous
// subpath — an M-break would restart the dash pattern per subpath and ruin
// the scroll reveal.)
export const BODY_HALF: Record<OverlayType, number> = {
  led: 9,
  capacitor: 6,
  diode: 9,
  zener: 9,
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
export const FLOW_PERIOD = 20;
export const FLOW_SPEED = 0.03;
export const FLOW_WINDOW = 800;

// Seven-segment layout: A top, B top-right, C bottom-right, D bottom,
// E bottom-left, F top-left, G middle. Digit cell is 14x24.
export const SEGMENT_LINES: Array<[number, number, number, number]> = [
  [2, 0, 12, 0], // A
  [14, 2, 14, 10], // B
  [14, 14, 14, 22], // C
  [2, 24, 12, 24], // D
  [0, 14, 0, 22], // E
  [0, 2, 0, 10], // F
  [2, 12, 12, 12], // G
];

export const DIGIT_SEGMENTS: Record<string, number[]> = {
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

export const INLINE_SPAN = 48;
