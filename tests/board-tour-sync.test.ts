import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The tour files under public/ are build artifacts that are checked in, so
 * they can drift from the assets-src/board-tours sources they come from.
 *
 * This guards one class of drift: the copy, the stop ids and the ordering.
 * That is what someone changes by editing a source and forgetting
 * `pnpm build:tour`, and it is all readable without a browser, which matters
 * because vitest runs in `environment: "node"` and the generator has to launch
 * Chromium to decompress an Interactive BOM.
 *
 * It does NOT guard the coordinates. A change in tools/board-tour-geometry.mjs
 * moves x, y and span while leaving id, label and blurb untouched, so these
 * assertions would pass straight through it. Two things cover that instead:
 * the e2e probe tests, which pin one stop per board to the world position its
 * part was confirmed to sit at, and the "Tour files are up to date" CI step in
 * .github/workflows/e2e.yml, which regenerates both boards and fails on any
 * diff at all. If you are adding a coordinate assertion here, prefer that step.
 */
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "assets-src/board-tours");
const builtDir = path.join(root, "public/portfolio/assets/viewers/tours");

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

interface Stop {
  id: string;
  label: string;
  blurb: string;
  x: number;
  y: number;
  span: number;
}

/**
 * Half extent in millimetres of each board's .pcbgeo model space, rounded up
 * from the measured bounds (control x -31.00..32.28 y -37.25..37.25, brick
 * x -79.40..78.59 y -79.70..78.95). A stop outside this is not on the board,
 * whatever its label says. An asset with no entry gets a loose sanity bound
 * rather than no bound.
 */
const halfExtent: Record<string, number> = { control: 38, brick: 80 };

const assets = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));

describe.each(assets)("%s.tour.json", (asset) => {
  const source = read(path.join(sourceDir, `${asset}.json`)) as { asset: string; stops: Stop[] };
  const built = read(path.join(builtDir, `${asset}.tour.json`)) as { asset: string; stops: Stop[] };

  it("is built from the current source, with the same stops in the same order", () => {
    expect(built.asset).toBe(asset);
    expect(source.asset).toBe(asset);
    expect(built.stops.map((stop) => ({ id: stop.id, label: stop.label, blurb: stop.blurb }))).toEqual(
      source.stops.map((stop) => ({ id: stop.id, label: stop.label, blurb: stop.blurb })),
    );
  });

  it("gives every stop copy the shell can show", () => {
    expect(built.stops.length).toBeGreaterThan(0);

    for (const stop of built.stops) {
      expect(typeof stop.id).toBe("string");
      expect(stop.label.length).toBeGreaterThan(0);
      expect(stop.blurb.length).toBeGreaterThan(0);
      // Cameron bans em-dashes in portfolio copy, and these strings are on screen.
      expect(stop.label).not.toContain("—");
      expect(stop.blurb).not.toContain("—");
    }
  });

  it("puts every stop on the board, with a span the camera can frame", () => {
    const bound = halfExtent[asset] ?? 200;

    for (const stop of built.stops) {
      expect(Math.abs(stop.x)).toBeLessThan(bound);
      expect(Math.abs(stop.y)).toBeLessThan(bound);
      expect(stop.span).toBeGreaterThan(0);
    }
  });
});
