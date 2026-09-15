import { motion } from "motion/react";

import { coursework, education, graduation } from "../data/portfolio";
import { SectionHeader } from "./SectionHeader";

/** Rail geometry, mirroring the Experience timeline so the two sections rhyme. */
const MARKER_SHELL_SIZE = 40;

const EM_DASH = "—";

interface ParsedCourse {
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
function parseCourse(raw: string): ParsedCourse {
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
function groupCoursework(entries: readonly string[]) {
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

type CourseGroup = ReturnType<typeof groupCoursework>[number];

/**
 * Packs the coursework into two balanced columns instead of a rigid grid, so a
 * one-course group never sits beside a three-course one with a void under it.
 *
 * A department's levels travel together as one block, upper year first, so
 * ECE 4000 is never stranded in a different column from ECE 3000. Blocks are
 * placed largest first into whichever column is currently shorter; a group's
 * height is its header row plus one row per course.
 */
function balanceColumns(groups: CourseGroup[]): CourseGroup[][] {
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

const metaClass =
  "font-mono text-[0.73rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]";

export function Education() {
  const courseColumns = balanceColumns(groupCoursework(coursework));

  return (
    <div className="space-y-8">
      <SectionHeader
        index="01"
        kicker="Education"
        title="Education"
        intro="Degree progress, academic highlights, and coursework supporting the hardware and systems work in the portfolio."
      />

      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-[20px] top-0 hidden h-full w-px bg-[var(--outline-strong)] lg:block"
        />

        {/* Forward-looking terminus: the rail runs up into the expected graduation. */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative pb-8 lg:pl-16"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 hidden items-center justify-center rounded-full border border-dashed border-[color:var(--outline-strong)] bg-[var(--surface-1)] lg:flex"
            style={{ width: MARKER_SHELL_SIZE, height: MARKER_SHELL_SIZE }}
          >
            <span className="size-2 rounded-full bg-primary" />
          </span>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <span className={metaClass}>{graduation.label}</span>
            <span className="h-px flex-1 bg-[var(--outline-soft)]" aria-hidden="true" />
            <span className="font-mono text-[0.95rem] font-semibold tracking-[0.02em] text-[color:var(--header-kicker-text)]">
              {graduation.date}
            </span>
          </div>
          <p className="mt-2 text-[0.98rem] text-[var(--text-soft)]">{graduation.detail}</p>
        </motion.div>

        {education.map((entry, index) => (
          <motion.article
            key={`${entry.institution}-${entry.period}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: (index + 1) * 0.06 }}
            className="relative pb-8 last:pb-0 lg:pl-16"
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 hidden items-center justify-center rounded-full border border-[color:var(--outline-strong)] bg-[var(--surface-4)] lg:flex"
              style={{ width: MARKER_SHELL_SIZE, height: MARKER_SHELL_SIZE }}
            >
              <span className="size-2.5 rounded-full bg-[var(--text-strong)]" />
            </span>

            <div className="rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={metaClass}>{entry.period}</span>
                <span
                  aria-hidden="true"
                  className="h-3 w-px bg-[var(--outline-strong)]"
                />
                <span className={metaClass}>{entry.gpa}</span>
              </div>

              <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                {entry.credential}
              </h3>
              <p className="mt-1 text-[var(--text-body)]">{entry.institution}</p>

              <p className="mt-4 text-[0.98rem] leading-8 text-[var(--text-soft)]">
                {entry.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {entry.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Signature block: the coursework index, keyed by department. */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18 }}
        className="lg:pl-16"
      >
        <div className="flex items-center gap-4">
          <span className={metaClass}>Key Coursework</span>
          <span className="h-px flex-1 bg-[var(--outline-soft)]" aria-hidden="true" />
          <span className="font-mono text-[0.73rem] tracking-[0.14em] text-[var(--text-muted)]">
            {String(coursework.length).padStart(2, "0")}
          </span>
        </div>

        <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {courseColumns.map((column) => (
            <div key={column[0].label} className="space-y-6">
              {column.map((group) => (
                <div key={group.label}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[0.73rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--header-kicker-text)]">
                      {group.label}
                    </span>
                    <span className="font-mono text-[0.68rem] tracking-[0.14em] text-[var(--text-muted)]">
                      {String(group.courses.length).padStart(2, "0")}
                    </span>
                  </div>

                  <ul className="mt-2 border-t border-[color:var(--outline-soft)]">
                    {group.courses.map((course) => (
                      <li
                        key={course.raw}
                        className="flex flex-col gap-0.5 border-b border-[color:var(--outline-soft)] py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
                      >
                        {course.code ? (
                          <span className="font-mono text-[0.78rem] tracking-[0.06em] text-[var(--text-muted)] sm:w-[5.6rem] sm:shrink-0">
                            {course.code}
                          </span>
                        ) : null}
                        <span className="text-[0.95rem] text-[var(--text-body)]">
                          {course.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
