import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { projects } from "../src/app/src/app/data/portfolio";
import { resolveBomUrl } from "../src/app/src/app/lib/board-assets";

// board-assets.ts resolves a BOM as `bomUrlByAsset[viewerAsset] ?? power`.
// `bomUrlByAsset` is typed `Record<string, string>` and tsconfig leaves
// `noUncheckedIndexedAccess` off, so a missing key types as `string` and the
// compiler treats the `?? power` arm as unreachable. A board whose entry is
// absent from the map therefore silently serves the POWER board's parts list:
// HTTP 200, wrong content, nothing throws. brick-buck hit exactly this once,
// hidden behind a per-project `bomUrl` override that has since been removed.
//
// These tests pin the invariant the type system cannot: the map must resolve
// every board to its own BOM.

const repoRoot = path.resolve(__dirname, "..");
const boardProjects = projects.filter((project) => project.viewerAsset);

describe("BOM asset map", () => {
  it("has board projects to check", () => {
    // Guards against the suite silently passing if `viewerAsset` is ever renamed.
    expect(boardProjects.length).toBeGreaterThan(0);
  });

  it.each(boardProjects.map((p) => [p.slug, p] as const))(
    "%s resolves to its own BOM file on disk",
    (_slug, project) => {
      const url = resolveBomUrl(project);
      expect(existsSync(path.join(repoRoot, "public", url))).toBe(true);

      // A non-power board must not land on the power BOM. This is the assertion
      // that fails when a `bomUrlByAsset` key is deleted.
      if (project.viewerAsset !== "power") {
        expect(url).not.toBe(resolveBomUrl({ ...project, viewerAsset: "power" }));
        expect(url).toContain(project.viewerAsset);
      }
    },
  );
});
