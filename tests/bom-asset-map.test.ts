import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { projects } from "../src/app/src/app/data/portfolio";
import { resolveBomUrl } from "../src/app/src/app/lib/board-assets";

// board-assets.ts resolves a BOM as `project.bomUrl ?? bomUrlByAsset[viewerAsset] ?? power`.
// The per-project `bomUrl` is an OVERRIDE, not the mechanism - but because
// `bomUrlByAsset` is typed `Record<string, string>` and tsconfig leaves
// `noUncheckedIndexedAccess` off, a missing key types as `string` and the
// compiler treats the `?? power` arm as unreachable. So a board whose entry is
// absent from the map silently serves the POWER board's parts list: HTTP 200,
// wrong content, nothing throws. That is exactly what happened to brick-buck,
// which only worked because it happened to set `bomUrl` explicitly.
//
// These tests pin the invariant the type system cannot: the map alone must
// resolve every board correctly, with every override removed.

const repoRoot = path.resolve(__dirname, "..");
const boardProjects = projects.filter((project) => project.viewerAsset);

describe("BOM asset map", () => {
  it("has board projects to check", () => {
    // Guards against the suite silently passing if `viewerAsset` is ever renamed.
    expect(boardProjects.length).toBeGreaterThan(0);
  });

  it.each(boardProjects.map((p) => [p.slug, p] as const))(
    "%s resolves to a BOM file that exists on disk",
    (_slug, project) => {
      const url = resolveBomUrl(project);
      expect(existsSync(path.join(repoRoot, "public", url))).toBe(true);
    },
  );

  it.each(boardProjects.map((p) => [p.slug, p] as const))(
    "%s still resolves to its own board with the bomUrl override removed",
    (_slug, project) => {
      const withoutOverride = { ...project, bomUrl: undefined };
      const url = resolveBomUrl(withoutOverride);

      // The map must carry this board on its own.
      expect(existsSync(path.join(repoRoot, "public", url))).toBe(true);

      // A non-power board must not land on the power BOM. This is the assertion
      // that fails when a `bomUrlByAsset` key is deleted.
      if (project.viewerAsset !== "power") {
        expect(url).not.toBe(resolveBomUrl({ ...project, bomUrl: undefined, viewerAsset: "power" }));
        expect(url).toContain(project.viewerAsset === "brick" ? "brick" : project.viewerAsset!);
      }
    },
  );
});
