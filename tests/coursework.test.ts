import { describe, expect, it } from "vitest";

import { coursework } from "../src/app/src/app/data/portfolio";
import {
  balanceColumns,
  groupCoursework,
  parseCourse,
} from "../src/app/src/app/lib/coursework";

/** The separator the coursework strings use between code and title. Kept here
 *  rather than imported so a change to the data format fails these tests
 *  loudly instead of being silently absorbed. */
const EM_DASH = "—";

describe("parseCourse", () => {
  it("splits a well-formed entry into department, level, code and title", () => {
    expect(parseCourse(`ECE-4300 ${EM_DASH} Electronic Circuits I`)).toEqual({
      department: "ECE",
      level: 4000,
      code: "ECE-4300",
      title: "Electronic Circuits I",
      raw: `ECE-4300 ${EM_DASH} Electronic Circuits I`,
    });
  });

  it("floors the level to its thousand", () => {
    expect(parseCourse(`ENGI-1020 ${EM_DASH} Intro`).level).toBe(1000);
    expect(parseCourse(`MATH-2050 ${EM_DASH} Linear Algebra`).level).toBe(2000);
    expect(parseCourse(`ECE-4800 ${EM_DASH} Electromechanical Devices`).level).toBe(4000);
  });

  it("keeps an unparseable entry verbatim as the title rather than dropping it", () => {
    const raw = "Some seminar with no course code";
    expect(parseCourse(raw)).toEqual({ department: "", level: 0, code: "", title: raw, raw });
  });

  it("treats an entry with a code but no title as unparseable", () => {
    const raw = `ECE-4300 ${EM_DASH} `;
    expect(parseCourse(raw).department).toBe("");
    expect(parseCourse(raw).title).toBe(raw.trim());
  });
});

describe("groupCoursework", () => {
  it("splits a department that spans levels, and labels each with its level", () => {
    const groups = groupCoursework([
      `ECE-3300 ${EM_DASH} Circuits`,
      `ECE-4300 ${EM_DASH} Electronic Circuits I`,
    ]);

    expect(groups.map((group) => group.label)).toEqual(["ECE 3000", "ECE 4000"]);
    expect(groups.map((group) => group.courses.length)).toEqual([1, 1]);
  });

  it("omits the level for a department that sits at only one, since the code already says it", () => {
    const groups = groupCoursework([
      `PHYS-3000 ${EM_DASH} Physics of Device Materials`,
      `MATH-2050 ${EM_DASH} Linear Algebra`,
    ]);

    expect(groups.map((group) => group.label)).toEqual(["PHYS", "MATH"]);
  });

  it("preserves first-appearance order across departments", () => {
    const groups = groupCoursework([
      `MATH-2050 ${EM_DASH} Linear Algebra`,
      `ECE-3300 ${EM_DASH} Circuits`,
      `PHYS-3000 ${EM_DASH} Physics`,
    ]);

    expect(groups.map((group) => group.department)).toEqual(["MATH", "ECE", "PHYS"]);
  });

  it("files unparseable entries under Other instead of losing them", () => {
    const groups = groupCoursework(["A seminar", `ECE-3300 ${EM_DASH} Circuits`]);

    expect(groups.map((group) => group.label)).toEqual(["Other", "ECE"]);
    expect(groups[0].courses[0].title).toBe("A seminar");
  });

  it("accounts for every entry it is given", () => {
    const groups = groupCoursework(coursework);
    const total = groups.reduce((sum, group) => sum + group.courses.length, 0);

    expect(total).toBe(coursework.length);
  });
});

describe("balanceColumns", () => {
  it("keeps a department's levels in the same column, upper year first", () => {
    const columns = balanceColumns(groupCoursework(coursework));

    for (const column of columns) {
      const ece = column.filter((group) => group.department === "ECE");
      if (ece.length > 1) {
        expect(ece.map((group) => group.level)).toEqual([...ece.map((g) => g.level)].sort((a, b) => b - a));
      }
    }

    // Every group of a department lands in exactly one column.
    for (const department of ["ECE", "ENGI"]) {
      const columnsWith = columns.filter((column) =>
        column.some((group) => group.department === department),
      );
      expect(columnsWith).toHaveLength(1);
    }
  });

  it("splits the real coursework across two columns without dropping a group", () => {
    const groups = groupCoursework(coursework);
    const columns = balanceColumns(groups);

    expect(columns).toHaveLength(2);
    expect(columns.flat()).toHaveLength(groups.length);
  });

  it("does not emit an empty column when there is only one department", () => {
    const columns = balanceColumns(groupCoursework([`ECE-3300 ${EM_DASH} Circuits`]));

    expect(columns).toHaveLength(1);
    expect(columns[0]).toHaveLength(1);
  });

  it("balances rather than filling the first column", () => {
    const columns = balanceColumns(
      groupCoursework([
        `ECE-3300 ${EM_DASH} A`,
        `ECE-3400 ${EM_DASH} B`,
        `ECE-3500 ${EM_DASH} C`,
        `PHYS-3000 ${EM_DASH} D`,
        `MATH-2050 ${EM_DASH} E`,
        `ENGI-1020 ${EM_DASH} F`,
      ]),
    );

    const heights = columns.map((column) =>
      column.reduce((total, group) => total + group.courses.length + 1, 0),
    );

    // The tallest column is never more than twice the shortest; a naive
    // fill-the-first-column pass would put all four groups on one side.
    expect(Math.max(...heights)).toBeLessThanOrEqual(Math.min(...heights) * 2);
  });
});
