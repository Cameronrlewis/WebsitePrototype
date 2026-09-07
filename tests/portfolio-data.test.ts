import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getOrganizationById,
  getProjectBySlug,
  organizations,
  projects,
  updateFeed,
} from "../src/app/src/app/data/portfolio";

const publicDir = path.resolve(__dirname, "../public");

/** Asset paths in portfolio.ts are site-absolute ("/portfolio/..."), which map
 *  to files under public/ at build time. */
function resolveAsset(assetPath: string) {
  return path.join(publicDir, assetPath.replace(/^\//, ""));
}

describe("portfolio content integrity", () => {
  it("every project references an organization that exists", () => {
    for (const project of projects) {
      expect(getOrganizationById(project.organizationId), `project "${project.slug}"`).toBeTruthy();
    }
  });

  it("every project slug is unique and resolvable", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(getProjectBySlug(slug)?.slug).toBe(slug);
    }
  });

  it("every referenced media and document asset exists on disk", () => {
    const missing: string[] = [];

    for (const project of projects) {
      const assets = [project.cardImg, project.bannerImg, project.hoverImg, project.bomUrl];
      for (const asset of assets) {
        if (typeof asset === "string" && asset.startsWith("/") && !existsSync(resolveAsset(asset))) {
          missing.push(`${project.slug}: ${asset}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("updateFeed is sorted newest first and every entry resolves its organization", () => {
    for (let index = 1; index < updateFeed.length; index += 1) {
      expect(updateFeed[index - 1].sortKey >= updateFeed[index].sortKey).toBe(true);
    }

    for (const entry of updateFeed) {
      expect(organizations.some((org) => org.id === entry.orgId)).toBe(true);
    }
  });
});
