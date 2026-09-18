import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The résumé PDF is built in a different repo (LaTeX + tectonic) and hand-copied
// in, so nothing in this repo's build can catch a bad copy. These assertions are
// the only automated check that the served file is a real, non-truncated PDF and
// that its preview raster still matches the dimensions optimize-media.py promises.

const repoRoot = path.resolve(__dirname, "..");
const pdfPath = path.join(
  repoRoot,
  "public/portfolio/assets/documents/resume/cameron-lewis-resume.pdf",
);
const previewPath = path.join(
  repoRoot,
  "public/portfolio/assets/media/documents/resume-preview-page-1.webp",
);

/** Reads an intrinsic size out of a WebP container without pulling in a decoder.
 *  Handles the VP8L (lossless) and VP8X (extended) chunk layouts that Pillow
 *  emits; throws on anything else so a format change fails loudly. */
function webpSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
  const fourcc = buf.subarray(12, 16).toString("ascii");

  if (fourcc === "VP8X") {
    // 24-bit little-endian canvas dimensions, stored minus one.
    const width = 1 + (buf.readUIntLE(24, 3) & 0xffffff);
    const height = 1 + (buf.readUIntLE(27, 3) & 0xffffff);
    return { width, height };
  }
  if (fourcc === "VP8 ") {
    // Lossy: 14-bit dimensions after the 3-byte start code + 0x9d012a signature.
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourcc === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  throw new Error(`unrecognised WebP chunk: ${fourcc}`);
}

describe("résumé assets", () => {
  it("serves a real PDF", () => {
    expect(existsSync(pdfPath)).toBe(true);
    const buf = readFileSync(pdfPath);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    // Trailer present => not truncated mid-copy.
    expect(buf.subarray(-1024).toString("latin1")).toContain("%%EOF");
    // Sanity band, not an exact size: catches an empty or wildly wrong file.
    expect(statSync(pdfPath).size).toBeGreaterThan(10_000);
    expect(statSync(pdfPath).size).toBeLessThan(2_000_000);
  });

  it("serves a preview raster at the dimensions optimize-media.py declares", () => {
    expect(existsSync(previewPath)).toBe(true);
    expect(webpSize(previewPath)).toEqual({ width: 1700, height: 2200 });
  });

  // ResumeViewer renders a static raster specifically so pdfjs-dist can stay
  // removed (a 362.3 KB lazy chunk); nothing else would notice its return,
  // since a re-added pdfjs gets inlined into the hash-named viewer chunk
  // rather than producing a pdfjs-named network request the e2e spec filters.
  it("does not reintroduce pdfjs-dist", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    expect(pkg.dependencies).not.toHaveProperty("pdfjs-dist");
    expect(pkg.devDependencies).not.toHaveProperty("pdfjs-dist");
  });
});
