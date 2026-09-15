import { motion } from "motion/react";

import { coursework, education, graduation } from "../data/portfolio";
import { balanceColumns, groupCoursework } from "../lib/coursework";
import { SectionHeader } from "./SectionHeader";

/** Rail geometry, mirroring the Experience timeline so the two sections rhyme. */
const MARKER_SHELL_SIZE = 40;

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
