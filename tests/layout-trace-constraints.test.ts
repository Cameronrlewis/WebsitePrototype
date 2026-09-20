import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MIN_GAP_DEPTH } from "../src/app/src/app/lib/circuit-geometry";
import { SECTION_IDS } from "../src/app/src/app/lib/routing";

// CircuitTrace measures the rendered layout instead of dictating it, so a
// spacing change in Layout can silently drop every IC block - no error, no
// failing render, just a bare spine. The constants live in circuit-geometry;
// this test is what ties Layout's markup back to them. Vitest runs in node
// here, so the check reads the source rather than a rendered tree.

const layoutSource = readFileSync(
  path.resolve(__dirname, "../src/app/src/app/components/Layout.tsx"),
  "utf8",
);

describe("Layout keeps CircuitTrace's measured constraints satisfiable", () => {
  it("leaves desktop inter-section gaps at or above MIN_GAP_DEPTH", () => {
    const match = layoutSource.match(/lg:space-y-(\d+)/);
    expect(match, "Layout lost its lg:space-y-* section stack").not.toBeNull();
    // Tailwind spacing step -> px: 0.25rem per step at the default 16px root.
    expect(Number(match![1]) * 4).toBeGreaterThanOrEqual(MIN_GAP_DEPTH);
  });

  it("still stacks all six sections so the gaps exist at all", () => {
    for (const id of SECTION_IDS) {
      expect(layoutSource).toContain(`data-section="${id}"`);
    }
  });

  it("keeps the gutter corridors the widest block needs horizontal room in", () => {
    // The buck block needs the most horizontal room of the six; the gutters are
    // what keep the trace's corridor clear of content at that width.
    expect(layoutSource).toMatch(/lg:pl-12/);
    expect(layoutSource).toMatch(/lg:pr-12/);
  });
});
