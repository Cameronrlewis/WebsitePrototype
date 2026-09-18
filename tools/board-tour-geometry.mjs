/**
 * Pure geometry for the board tour build. Kept separate from the build tool so
 * it can be unit tested without launching a browser.
 */

/**
 * Converts a KiCad millimetre position into board-local millimetres, with the
 * board outline's centre at the origin. KiCad measures y downward and the
 * exported geometry measures it upward, so `flipY` negates it.
 */
export function toBoardLocal(pos, edgesBbox, flipY) {
  const cx = (edgesBbox.minx + edgesBbox.maxx) / 2;
  const cy = (edgesBbox.miny + edgesBbox.maxy) / 2;
  const y = pos[1] - cy;

  return { x: round(pos[0] - cx), y: round(flipY ? -y : y) };
}

/** Centre and size of one stop, which may cover several footprints. */
export function stopCenter(refs, footprints) {
  const byRef = new Map(footprints.map((f) => [f.ref, f]));
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;

  for (const ref of refs) {
    const fp = byRef.get(ref);
    if (!fp) {
      throw new Error(`Tour references ${ref}, which is not on this board.`);
    }

    const [px, py] = fp.bbox.pos;
    const [w, h] = fp.bbox.size;
    minx = Math.min(minx, px - w / 2);
    maxx = Math.max(maxx, px + w / 2);
    miny = Math.min(miny, py - h / 2);
    maxy = Math.max(maxy, py + h / 2);
  }

  return {
    pos: [round((minx + maxx) / 2), round((miny + maxy) / 2)],
    span: round(Math.max(maxx - minx, maxy - miny)),
  };
}

// Millimetre positions do not need more than this, and exact values keep the
// generated file stable and reviewable in diffs. The `rounded === 0` check
// normalises -0 to 0: do not remove it. A centred coordinate can legitimately
// compute to -0 (e.g. flipping y at exactly the outline centre), and vitest's
// toEqual treats -0 and 0 as unequal, so the "origin" test fails without it.
function round(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
}
