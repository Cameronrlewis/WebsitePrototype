import { describe, expect, it } from "vitest";
import { parseHash } from "./Layout";

describe("parseHash", () => {
  it("defaults to home when hash is empty", () => {
    expect(parseHash("")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("routes #/updates to the updates view", () => {
    expect(parseHash("#/updates")).toEqual({ view: "updates", section: "home", project: null });
  });

  it("routes a known section id to the portfolio view", () => {
    expect(parseHash("#/education")).toEqual({ view: "portfolio", section: "education", project: null });
  });

  it("falls back to home for an unknown section id", () => {
    expect(parseHash("#/not-a-real-section")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("falls back to the projects section (not home) for a project slug that doesn't exist", () => {
    // "projects" is itself a valid SectionId, so a missing project slug falls
    // through to the isSectionId(first) branch rather than all the way to home.
    expect(parseHash("#/projects/not-a-real-slug")).toEqual({ view: "portfolio", section: "projects", project: null });
  });
});
