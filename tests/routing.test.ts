import { describe, expect, it } from "vitest";

import { parseHash } from "../src/app/src/app/lib/routing";
import { projects } from "../src/app/src/app/data/portfolio";

describe("parseHash", () => {
  it("defaults to the portfolio home view for an empty hash", () => {
    expect(parseHash("")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("routes #/updates to the updates view", () => {
    expect(parseHash("#/updates")).toEqual({ view: "updates", section: "home", project: null });
  });

  it("routes a known section id to that section", () => {
    expect(parseHash("#/education")).toEqual({ view: "portfolio", section: "education", project: null });
  });

  it("routes a known project slug to the projects section with that project", () => {
    const slug = projects[0].slug;
    const result = parseHash(`#/projects/${slug}`);
    expect(result.view).toBe("portfolio");
    expect(result.section).toBe("projects");
    expect(result.project?.slug).toBe(slug);
  });

  it("sends an unresolvable project slug back to home", () => {
    expect(parseHash("#/projects/does-not-exist")).toEqual({
      view: "portfolio",
      section: "home",
      project: null,
    });
  });

  it("routes a bare #/projects (no slug) to the projects section", () => {
    expect(parseHash("#/projects")).toEqual({ view: "portfolio", section: "projects", project: null });
  });

  it("falls back to home for an unknown section", () => {
    expect(parseHash("#/nonsense")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("tolerates a hash with no leading slash", () => {
    expect(parseHash("#skills")).toEqual({ view: "portfolio", section: "skills", project: null });
  });
});
