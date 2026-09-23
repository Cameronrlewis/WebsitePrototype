import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every net the portfolio-data test builds points inward at src/ (project
// records only). This test points outward instead: it scans every source and
// HTML file for a `/portfolio/assets/...` reference - however it's spelled -
// and checks the file actually exists under public/. That's the class of bug
// that let a dangling og:image (index.html) and two orphaned scripts
// (public/) survive a 25-commit review.

const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, exts, out);
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/** Pulls every asset path referenced in `text`, covering both forms used in
 *  this codebase: a direct string literal ("/portfolio/assets/...", optionally
 *  prefixed with the production origin as in index.html's meta tags), and a
 *  template literal built from portfolio.ts's `assetBase` constant
 *  (`${assetBase}/media/...`). `truncated` marks a path cut off by a further
 *  `${...}` interpolation, so only the captured prefix is known. */
function extractAssetPaths(text: string): { path: string; truncated: boolean }[] {
  // A path seen both whole and cut off is held to the stricter, whole check.
  const paths = new Map<string, boolean>();
  const add = (assetPath: string, truncated: boolean) =>
    paths.set(assetPath, (paths.get(assetPath) ?? true) && truncated);

  const directRe = /(?:https:\/\/cameron-lewis\.com)?(\/portfolio\/[A-Za-z0-9._\-/]+)(\$\{)?/g;
  for (const match of text.matchAll(directRe)) {
    add(match[1], match[2] !== undefined);
  }

  const templateRe = /\$\{assetBase\}([A-Za-z0-9._\-/]+)(\$\{)?/g;
  for (const match of text.matchAll(templateRe)) {
    add(`/portfolio/assets${match[1]}`, match[2] !== undefined);
  }

  return [...paths].map(([assetPath, truncated]) => ({ path: assetPath, truncated }));
}

/** A path must exist exactly. Only one cut off by an interpolation (e.g.
 *  reportPages' per-page `page-${page}.webp` loop, captured only up to
 *  "page-") may instead match some file in its directory by prefix. */
function resolves({ path: assetPath, truncated }: { path: string; truncated: boolean }): boolean {
  const resolved = path.join(publicDir, assetPath.replace(/^\//, ""));
  if (existsSync(resolved)) return true;
  if (!truncated) return false;

  const dir = path.dirname(resolved);
  const prefix = path.basename(resolved);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((entry) => entry.startsWith(prefix));
}

describe("every /portfolio/assets reference resolves to a real file", () => {
  const sourceFiles = [
    ...walk(path.join(repoRoot, "src"), [".ts", ".tsx"]),
    path.join(repoRoot, "index.html"),
    ...walk(publicDir, [".html"]),
  ];

  it("src/**, index.html, and public/**/*.html only reference files that exist under public/", () => {
    const missing: string[] = [];

    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf-8");
      for (const ref of extractAssetPaths(text)) {
        if (!resolves(ref)) {
          missing.push(`${path.relative(repoRoot, file)}: ${ref.path}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

describe("the prefix fallback only covers paths cut off by an interpolation", () => {
  it("rejects a truncated literal path that merely prefixes a real file", () => {
    const text = [
      '"/portfolio/assets/media/projects/aux-power-board-banner.web"',
      "`${assetBase}/media/projects/aux`",
    ].join("\n");
    expect(extractAssetPaths(text).filter((ref) => !resolves(ref))).toHaveLength(2);
  });

  it("still accepts a path cut off at a second interpolation", () => {
    const text = "`${assetBase}/media/reports/engineering-1030/page-${page}.webp`";
    expect(extractAssetPaths(text).filter((ref) => !resolves(ref))).toEqual([]);
  });
});
