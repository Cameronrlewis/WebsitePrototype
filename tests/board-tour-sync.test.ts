import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The generated tour files are checked in, so they can drift from the sources
 * they are built from: someone edits a blurb in assets-src/board-tours and
 * forgets `pnpm build:tour`, or the generator's geometry changes and only one
 * of the two boards gets regenerated. That second case actually happened.
 *
 * This asserts the copy half of "generated matches source" rather than
 * regenerating and diffing, because regenerating means launching Chromium to
 * decompress an Interactive BOM and vitest runs in `environment: "node"`. The
 * coordinate half is covered by e2e/board-spin.spec.ts, which pins one stop
 * per board to the world position its part was seen at.
 */
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "assets-src/board-tours");
const builtDir = path.join(root, "public/portfolio/assets/viewers/tours");

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

interface Stop {
  id: string;
  label: string;
  blurb: string;
}

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

  it("carries no em-dash in copy that reaches the page", () => {
    for (const stop of built.stops) {
      expect(stop.label).not.toContain("—");
      expect(stop.blurb).not.toContain("—");
    }
  });
});
