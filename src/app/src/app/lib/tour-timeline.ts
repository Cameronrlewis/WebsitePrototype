/**
 * The tour's schedule, as pure arithmetic over elapsed time. The viewer shell
 * mirrors this in plain JS because it has no module loader; this copy is the
 * tested one, and the shell's copy carries a pointer back to it.
 */

export interface TourTiming {
  /** One free revolution before the first stop. */
  orbitMs: number;
  /** One camera move, whether between stops or in and out of the orbit. */
  travelMs: number;
  /** How long the camera rests on a stop. */
  holdMs: number;
}

export type TourPhaseResult =
  | { kind: "orbit"; progress: number }
  | { kind: "travel"; from: number; to: number; progress: number }
  | { kind: "hold"; stop: number; progress: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Symmetric ease, slow at both ends. */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function tourPhase(elapsedMs: number, stopCount: number, timing: TourTiming): TourPhaseResult {
  const { orbitMs, travelMs, holdMs } = timing;

  if (stopCount <= 0) {
    return { kind: "orbit", progress: (Math.max(0, elapsedMs) % orbitMs) / orbitMs };
  }

  // orbit, then (travel + hold) per stop, then one travel back to the orbit.
  const cycleMs = orbitMs + stopCount * (travelMs + holdMs) + travelMs;
  let t = Math.max(0, elapsedMs) % cycleMs;

  if (t < orbitMs) {
    return { kind: "orbit", progress: t / orbitMs };
  }

  t -= orbitMs;

  for (let index = 0; index < stopCount; index += 1) {
    if (t < travelMs) {
      return { kind: "travel", from: index - 1, to: index, progress: t / travelMs };
    }

    t -= travelMs;

    if (t < holdMs) {
      return { kind: "hold", stop: index, progress: t / holdMs };
    }

    t -= holdMs;
  }

  return { kind: "travel", from: stopCount - 1, to: -1, progress: t / travelMs };
}
