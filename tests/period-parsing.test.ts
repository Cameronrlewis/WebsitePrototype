import { describe, expect, it } from "vitest";

import { parsePeriodStart, parseWeekSortKey, updateFeed } from "../src/app/src/app/data/portfolio";

describe("parsePeriodStart", () => {
  it("parses a well-formed 'Mon YYYY' period (happy path)", () => {
    expect(parsePeriodStart("Jan 2026")).toBe(20260100);
  });

  it("parses the first token of an em-dash-separated range", () => {
    expect(parsePeriodStart("Jan 2026 — Mar 2026")).toBe(20260100);
  });

  it("returns 0 when the em-dash separator is removed entirely", () => {
    // If the standing no-em-dash content rule strips the separator without
    // replacing it, the trailing text breaks both regexes and this silently
    // drops to 0 instead of throwing.
    expect(parsePeriodStart("Jan 2026 Mar 2026")).toBe(0);
  });

  it("returns 0 when a plain hyphen is used instead of an em-dash", () => {
    expect(parsePeriodStart("Jan 2026 - Mar 2026")).toBe(0);
  });

  it("parses a full month name", () => {
    expect(parsePeriodStart("September 2025 — Present")).toBe(20250900);
  });

  it("defaults an unknown month abbreviation to January instead of failing loudly", () => {
    expect(parsePeriodStart("Xyz 2026")).toBe(20260100);
  });
});

describe("parseWeekSortKey", () => {
  it("parses a well-formed week string (happy path)", () => {
    expect(parseWeekSortKey("Apr 12th - 18th, 2026")).toBe(20260412);
  });

  it("returns 0 when the string does not match the expected pattern", () => {
    expect(parseWeekSortKey("TBD")).toBe(0);
  });

  it("parses a full month name instead of defaulting it to January", () => {
    expect(parseWeekSortKey("September 12th - 18th, 2026")).toBe(20260912);
  });
});

describe("updateFeed date parsing regression guard", () => {
  it("every entry's period string parses to a non-zero sort key", () => {
    const badEntries = updateFeed
      .filter((entry) => parsePeriodStart(entry.period) === 0)
      .map((entry) => `${entry.orgId}/${entry.buildId}: "${entry.period}"`);

    expect(badEntries).toEqual([]);
  });
});
