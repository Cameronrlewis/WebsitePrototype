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

/**
 * The four page-space corners of one footprint's bounding box.
 *
 * IBOM draws the box as `translate(pos); rotate(-angle); translate(relpos);
 * rect(0, 0, ...size)`, so `pos` is the footprint's placement origin, not the
 * box. On a footprint whose origin sits at its own centre `relpos` is exactly
 * `-size / 2` and the box centre lands back on `pos`, which is why treating
 * `pos` as the centre worked for the control board. It does not hold in
 * general: on the brick board J11 is 13mm and K1 9mm away from their own `pos`.
 */
function corners(bbox) {
  const [px, py] = bbox.pos;
  const [rx, ry] = bbox.relpos ?? [-bbox.size[0] / 2, -bbox.size[1] / 2];
  const [w, h] = bbox.size;
  const a = (-(bbox.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  return [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => [px + (rx + x) * cos - (ry + y) * sin, py + (rx + x) * sin + (ry + y) * cos]);
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

    for (const [x, y] of corners(fp.bbox)) {
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
    }
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
