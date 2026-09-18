#!/usr/bin/env node
// Installs a freshly compiled résumé PDF and regenerates its preview raster.
//
// Guard first, install second: ResumeViewer renders ONLY page 1 as a static
// image, so a two-page résumé would silently lose a page on the site. This
// refuses to run in that case and tells you what to do about it. Only after
// the page-1 raster has rendered does it copy the source PDF into public/,
// which is the only way that file is meant to reach the repo.
//
// Usage: node tools/build-resume-preview.mjs /path/to/cameron-lewis-resume.pdf

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const ORIGINAL = path.join(repoRoot, "assets-src/media-originals/resume-preview-page-1.png");
const INSTALLED_PDF = path.join(repoRoot, "public/portfolio/assets/documents/resume/cameron-lewis-resume.pdf");
const DPI = 200; // 8.5x11in @ 200dpi = exactly 1700x2200, matching the shipped asset

const pdfPath = process.argv[2];
if (!pdfPath || !existsSync(pdfPath)) {
  console.error("usage: node tools/build-resume-preview.mjs <path-to-pdf>");
  process.exit(2);
}

function pageCount(file) {
  // pdfinfo ships with pdftoppm (Poppler), which this script already needs.
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  const match = info.match(/^Pages:\s+(\d+)$/m);
  if (!match) throw new Error("pdfinfo did not report a page count");
  return Number(match[1]);
}

const pages = pageCount(pdfPath);
if (pages !== 1) {
  console.error(
    `refusing to build: ${path.basename(pdfPath)} has ${pages} pages, expected 1.\n` +
      "ResumeViewer renders a single static image of page 1, so pages 2+ would\n" +
      "not appear on the site. Either trim the résumé back to one page, or\n" +
      "restore a multi-page viewer before regenerating this asset.",
  );
  process.exit(1);
}

const scratch = mkdtempSync(path.join(tmpdir(), "resume-preview-"));
execFileSync("pdftoppm", ["-png", "-r", String(DPI), "-f", "1", "-l", "1", pdfPath, path.join(scratch, "page")], {
  stdio: "inherit",
});
copyFileSync(path.join(scratch, "page-1.png"), ORIGINAL);
console.log(`wrote ${path.relative(repoRoot, ORIGINAL)}`);

// Encode the single .webp through optimize-media.py's own functions, so quality
// and sizing stay in one place. Running that script bare would re-encode all ~45
// listed assets and rewrite ~44 unrelated files.
const py = `
import importlib.util
from pathlib import Path
from PIL import Image
spec = importlib.util.spec_from_file_location('om', 'tools/optimize-media.py')
om = importlib.util.module_from_spec(spec); spec.loader.exec_module(om)
name = 'documents/resume-preview-page-1.png'
src, _ = om.resolve_source(name)
img, _ = om.load_for_web(src)
w, h = img.size
scale = min(1.0, om.MAX_EDGE / max(w, h))
out = om.MEDIA / Path(name).with_suffix('.webp')
img.resize((round(w*scale), round(h*scale)), Image.LANCZOS).save(
    out, 'WEBP', quality=om.QUALITY[name], method=6)
print('wrote', out)
`;
execFileSync("python3", ["-c", py], { cwd: repoRoot, stdio: "inherit" });

// Install the source PDF only after the preview above has rendered successfully,
// so a failed render never leaves a new PDF committed against a stale raster.
if (path.resolve(pdfPath) === INSTALLED_PDF) {
  console.log(`${path.relative(repoRoot, INSTALLED_PDF)} is already the source; skipping copy`);
} else {
  copyFileSync(pdfPath, INSTALLED_PDF);
  console.log(`wrote ${path.relative(repoRoot, INSTALLED_PDF)}`);
}
