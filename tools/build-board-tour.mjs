/**
 * Joins assets-src/board-tours/<asset>.json against the checked-in Interactive
 * BOM and writes public/portfolio/assets/viewers/tours/<asset>.tour.json.
 *
 * The IBOM stores its payload LZString-compressed inside a script tag, so the
 * only reliable way to read it is to let a browser run the page. Playwright's
 * Chromium ships with the dev dependencies, so this adds nothing to install.
 *
 * Usage: npx pnpm@10.17.1 build:tour [asset]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { stopCenter, toBoardLocal } from "./board-tour-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The exported geometry measures y upward while KiCad measures it downward.
// Task 2 verifies this against the rendered board.
const FLIP_Y = true;

const bomByAsset = {
  power: "public/portfolio/assets/bom/power/IBOM.html",
  control: "public/portfolio/assets/bom/control/IBOM.html",
  brick: "public/portfolio/assets/bom/brick-buck/IBOM.html",
};

async function readPcbData(bomPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // The IBOM logs its own errors on load; they are not ours to fix.
    page.on("pageerror", () => {});
    await page.goto(pathToFileURL(path.join(root, bomPath)).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.pcbdata !== "undefined", null, { timeout: 30000 });
    return await page.evaluate(() => ({
      edges_bbox: window.pcbdata.edges_bbox,
      footprints: window.pcbdata.footprints.map((f) => ({ ref: f.ref, bbox: { pos: f.bbox.pos, size: f.bbox.size } })),
    }));
  } finally {
    await browser.close();
  }
}

async function build(asset) {
  const bomPath = bomByAsset[asset];
  if (!bomPath) {
    throw new Error(`No interactive BOM is mapped for asset "${asset}".`);
  }

  const source = JSON.parse(await readFile(path.join(root, `assets-src/board-tours/${asset}.json`), "utf8"));
  const { edges_bbox: edges, footprints } = await readPcbData(bomPath);

  const stops = source.stops.map((stop) => {
    const { pos, span } = stopCenter(stop.refs, footprints);
    const local = toBoardLocal(pos, edges, FLIP_Y);
    return { id: stop.id, label: stop.label, blurb: stop.blurb, refs: stop.refs, x: local.x, y: local.y, span };
  });

  const outDir = path.join(root, "public/portfolio/assets/viewers/tours");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${asset}.tour.json`);
  await writeFile(outPath, `${JSON.stringify({ asset, flipY: FLIP_Y, stops }, null, 2)}\n`, "utf8");

  console.log(`wrote ${path.relative(root, outPath)}: ${stops.length} stops`);
  for (const stop of stops) {
    console.log(`  ${stop.id.padEnd(12)} ${stop.refs.join("+").padEnd(8)} x=${stop.x} y=${stop.y} span=${stop.span}`);
  }
}

const asset = process.argv[2] ?? "control";
build(asset).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
