import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The tour files under public/ are build artifacts that are checked in, so
 * they can drift from the assets-src/board-tours sources they come from.
 *
 * Drift itself is not this file's job. The "Tour files are up to date" CI step
 * in .github/workflows/e2e.yml rebuilds both boards and fails on any diff,
 * coordinates included, on every push and pull request - a strict superset of
 * anything asserted here, and the right place to add a coordinate check.
 *
 * What is left is what a rebuild cannot catch, because a faithfully rebuilt
 * file can still be wrong: copy the shell has nothing to show, an em-dash, or
 * a stop that is nowhere near the board. Those run without a browser, which
 * matters because vitest runs in `environment: "node"` and the generator has
 * to launch Chromium to decompress an Interactive BOM.
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
 * whatever its label says. A new board must add its own entry here; the
 * assertion below fails loudly on a missing one rather than waving it through.
 */
const halfExtent: Record<string, number> = { control: 38, brick: 80 };

const assets = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));

describe.each(assets)("%s.tour.json", (asset) => {
  const built = read(path.join(builtDir, `${asset}.tour.json`)) as { asset: string; stops: Stop[] };

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
    const bound = halfExtent[asset];
    expect(bound, `no half extent recorded for ${asset}; measure the board and add one`).toBeGreaterThan(0);

    for (const stop of built.stops) {
      expect(Math.abs(stop.x)).toBeLessThan(bound);
      expect(Math.abs(stop.y)).toBeLessThan(bound);
      expect(stop.span).toBeGreaterThan(0);
    }
  });
});
