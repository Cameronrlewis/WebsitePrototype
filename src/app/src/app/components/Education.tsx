import { motion } from "motion/react";
import { GraduationCap, Trophy } from "lucide-react";

import { coursework, education, graduation } from "../data/portfolio";

export function Education() {
  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Education</h1>
        <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
          Degree progress, academic highlights, and coursework supporting the hardware and systems work in the portfolio.
        </p>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-5">
          {education.map((entry, index) => (
            <motion.article
              key={`${entry.institution}-${entry.period}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className={`rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)] ${
                entry.credential === "High School Diploma" ? "min-h-[19.4rem]" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[1rem] bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
                  <GraduationCap className="size-5" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{entry.credential}</h2>
                      <p className="mt-1 text-[var(--text-body)]">{entry.institution}</p>
                    </div>

                    <div className="text-sm text-[var(--text-muted)] lg:text-right">
                      <div>{entry.period}</div>
                      <div className="mt-1">{entry.gpa}</div>
                    </div>
                  </div>

                  <p
                    className={`mt-4 text-[0.98rem] text-[var(--text-soft)] ${
                      entry.credential === "High School Diploma" ? "leading-[2.35rem]" : "leading-8"
                    }`}
                  >
                    {entry.description}
                  </p>

                  <div
                    className={`flex flex-wrap gap-2 ${
                      entry.credential === "High School Diploma" ? "mt-auto pt-4" : "mt-5"
                    }`}
                  >
                    {entry.highlights.map((highlight) => (
                      <span key={highlight} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06 }}
            className="rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Trophy className="size-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{graduation.label}</h3>
                <p className="text-sm text-[var(--text-muted)]">{graduation.detail}</p>
              </div>
            </div>
            <p className="mt-5 text-[2.4rem] font-semibold tracking-[-0.05em] text-[var(--text-strong)]">{graduation.date}</p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
          >
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">Key Coursework</h3>
            <div className="mt-5 space-y-3">
              {coursework.map((course) => (
                <div key={course} className="flex items-start gap-3 border-b border-[color:var(--outline-soft)] pb-3 text-[0.98rem] text-[var(--text-body)] last:border-b-0 last:pb-0">
                  <span className="mt-2 size-2 rounded-full bg-primary" />
                  <span>{course}</span>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
