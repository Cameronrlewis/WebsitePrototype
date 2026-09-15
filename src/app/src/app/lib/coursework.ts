// Pure shaping for the Education section's coursework index.
//
// Extracted from Education.tsx so the grouping rules are testable: which
// courses land under which heading, when a level earns a place in the label,
// and how department blocks pack into columns. None of it touches the DOM or
// React; it takes the raw coursework strings and returns render-ready groups.

const EM_DASH = "—";

export interface ParsedCourse {
  /** Alpha prefix of the course code, e.g. "ECE". Empty when the string doesn't parse. */
  department: string;
  /** Full course code, e.g. "ECE-3300". Empty when the string doesn't parse. */
  code: string;
  /** Thousand-level of the course number, e.g. 4000 for ECE-4300. Zero when unknown. */
  level: number;
  /** Course title, or the verbatim source string when it doesn't parse. */
  title: string;
  /** Original string, used as a stable key. */
  raw: string;
}

/**
 * Splits "ECE-3300 — Circuits & Electronics" into its code, title and department.
 * Anything that doesn't carry an em-dash is kept verbatim as the title so no
 * course is ever dropped or mangled.
 */
export function parseCourse(raw: string): ParsedCourse {
  const separator = raw.indexOf(EM_DASH);
  if (separator === -1) {
    return { department: "", level: 0, code: "", title: raw.trim(), raw };
  }

  const code = raw.slice(0, separator).trim();
  const title = raw.slice(separator + EM_DASH.length).trim();
  const prefix = /^[A-Za-z]+/.exec(code);

  if (!code || !title || !prefix) {
    return { department: "", level: 0, code: "", title: raw.trim(), raw };
  }

  const number = /(\d+)/.exec(code);
  const level = number ? Math.floor(Number(number[1]) / 1000) * 1000 : 0;

  return { department: prefix[0].toUpperCase(), level, code, title, raw };
}

/**
 * Groups parsed courses by department and level, preserving first-appearance
 * order, so upper-year work reads as its own block rather than sitting in one
 * flat list with the foundations. The level is only shown for departments that
 * span more than one; elsewhere it would just repeat the course code.
 */
export function groupCoursework(entries: readonly string[]) {
  const groups: { department: string; level: number; courses: ParsedCourse[] }[] = [];

  for (const entry of entries) {
    const course = parseCourse(entry);
    const department = course.department || "Other";
    const existing = groups.find(
      (group) => group.department === department && group.level === course.level,
    );
    if (existing) {
      existing.courses.push(course);
    } else {
      groups.push({ department, level: course.level, courses: [course] });
    }
  }

  const spansLevels = new Set(
    groups
      .filter((group, _, all) =>
        all.some((other) => other.department === group.department && other.level !== group.level),
      )
      .map((group) => group.department),
  );

  return groups.map((group) => ({
    ...group,
    label: spansLevels.has(group.department) && group.level
      ? `${group.department} ${group.level}`
      : group.department,
  }));
}

export type CourseGroup = ReturnType<typeof groupCoursework>[number];

/**
 * Packs the coursework into two balanced columns instead of a rigid grid, so a
 * one-course group never sits beside a three-course one with a void under it.
 *
 * A department's levels travel together as one block, upper year first, so
 * ECE 4000 is never stranded in a different column from ECE 3000. Blocks are
 * placed largest first into whichever column is currently shorter; a group's
 * height is its header row plus one row per course.
 */
export function balanceColumns(groups: CourseGroup[]): CourseGroup[][] {
  const blocks: CourseGroup[][] = [];

  for (const group of groups) {
    const existing = blocks.find((block) => block[0].department === group.department);
    if (existing) {
      existing.push(group);
    } else {
      blocks.push([group]);
    }
  }

  for (const block of blocks) {
    block.sort((a, b) => b.level - a.level);
  }

  const height = (block: CourseGroup[]) =>
    block.reduce((total, group) => total + group.courses.length + 1, 0);

  const columns: CourseGroup[][] = [[], []];
  const heights = [0, 0];

  for (const block of [...blocks].sort((a, b) => height(b) - height(a))) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(...block);
    heights[target] += height(block);
  }

  return columns.filter((column) => column.length > 0);
}
