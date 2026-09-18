import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// tests/asset-references.test.ts proves every referenced asset exists on disk.
// This proves the converse: every asset key declared in `documents` is actually
// consumed by application code. `resumePreview` shipped 421 KB to production for
// months with zero consumers because nothing watched this direction.

const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "src");
const dataFile = path.join(repoRoot, "src/app/src/app/data/portfolio.ts");

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

/** Pulls the keys out of the `export const documents = { ... }` object literal. */
function documentKeys(): string[] {
  const text = readFileSync(dataFile, "utf8");
  const match = text.match(/export const documents = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error("could not locate the `documents` object literal");
  return [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]);
}

describe("documents asset map", () => {
  it("declares no key that application code never reads", () => {
    const keys = documentKeys();
    expect(keys.length).toBeGreaterThan(0);

    const sources = walk(srcDir, [".ts", ".tsx"]);
    const haystack = sources
      .map((file) => {
        const text = readFileSync(file, "utf8");
        // The declaration itself is not a consumer. Everything else in
        // portfolio.ts is: `engineeringReport`'s only reader is the project
        // record at portfolio.ts:498, which does flow out to the UI.
        return file === dataFile
          ? text.replace(/export const documents = \{[\s\S]*?\n\};/, "")
          : text;
      })
      .join("\n");

    const orphans = keys.filter((key) => {
      // Matches `documents.resume`, `documents["resume"]`, and destructuring.
      const patterns = [
        new RegExp(`documents\\.${key}\\b`),
        new RegExp(`documents\\[["']${key}["']\\]`),
        new RegExp(`\\b${key}\\b[^:]*\\}\\s*=\\s*documents`),
      ];
      return !patterns.some((p) => p.test(haystack));
    });

    expect(orphans).toEqual([]);
  });
});
