import { describe, expect, it } from "vitest";

import { isAppRoute, parseHash } from "../src/app/src/app/lib/routing";
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

  // parseHash itself has no way to tell "unknown route" from "not a route at
  // all" apart, so it falls back to home for both - that's expected, and not
  // the bug. The skip link firing the router (#main-content routing home and
  // closing an open modal) is fixed by useHashRoute's hashchange listener
  // never calling parseHash for a non-route hash in the first place.
  it("falls back to home for a plain in-page anchor, same as any other non-route hash", () => {
    expect(parseHash("#main-content")).toEqual({ view: "portfolio", section: "home", project: null });
  });
});

describe("isAppRoute", () => {
  it("accepts the app's own hash routes", () => {
    expect(isAppRoute("#/education")).toBe(true);
    expect(isAppRoute(`#/projects/${projects[0].slug}`)).toBe(true);
    expect(isAppRoute("#/updates")).toBe(true);
  });

  it("rejects a plain in-page anchor like the skip link's target", () => {
    expect(isAppRoute("#main-content")).toBe(false);
  });

  it("rejects an empty hash", () => {
    expect(isAppRoute("")).toBe(false);
  });
});
