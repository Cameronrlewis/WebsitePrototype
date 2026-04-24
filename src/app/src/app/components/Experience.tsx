import { motion } from "motion/react";
import { CalendarDays, MapPin } from "lucide-react";

import { experience } from "../data/portfolio";

const CARD_PADDING = 24;
const MARKER_SHELL_SIZE = 40;
const MARKER_CENTER_X = 20;

export function Experience() {
  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Work Experience</h1>
        <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
          Internships, team projects, and hands-on hardware work across PCB design, documentation, and embedded systems.
        </p>
      </motion.section>

      <div className="relative space-y-0">
        <div className="absolute left-[20px] top-0 hidden h-full w-px bg-[var(--text-strong)] lg:block" />

        {experience.map((entry, index) => {
          const { logoSize, markerImageSize, markerTop } = getExperienceSizing(entry.company);

          return (
            <motion.article
              key={`${entry.company}-${entry.period}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className="relative pb-8 last:pb-0 lg:pl-16"
            >
              <div
                className="absolute left-0 hidden items-center justify-center rounded-full border-2 border-[color:var(--text-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)] lg:flex"
                style={{
                  top: `${markerTop}px`,
                  width: `${MARKER_SHELL_SIZE}px`,
                  height: `${MARKER_SHELL_SIZE}px`,
                  left: `${MARKER_CENTER_X - MARKER_SHELL_SIZE / 2}px`,
                }}
              >
                <img
                  src={entry.marker || entry.logo}
                  alt=""
                  className="object-contain"
                  style={{ width: `${markerImageSize}px`, height: `${markerImageSize}px` }}
                />
              </div>

              <div className="rounded-[18px] border-2 border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
                  <div className="flex min-w-0 flex-1 items-start gap-[14px]">
                    <img
                      src={entry.logo}
                      alt={entry.company}
                      className="shrink-0 object-contain"
                      style={{
                        width: `${logoSize}px`,
                        height: `${logoSize}px`,
                        marginLeft: entry.company.includes("Paradigm") ? "8px" : "0px",
                        marginTop: entry.company.includes("Paradigm") ? "10px" : "0px",
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{entry.role}</h2>
                      <p className="mt-1 text-lg text-[var(--text-body)] lg:whitespace-nowrap">{entry.company}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-body)] lg:justify-end">
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="size-4" />
                      {entry.period}
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {entry.location}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {entry.bullets.map((bullet) => (
                    <p key={bullet.slice(0, 24)} className="text-[0.98rem] leading-8 text-[var(--text-strong)]">
                      {bullet}
                    </p>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function getExperienceSizing(company: string) {
  const isParadigm = company.includes("Paradigm");
  const logoSize = isParadigm ? 58 : 75;
  const markerImageSize = isParadigm ? 28 : 30;
  const markerTop = CARD_PADDING + logoSize / 2 - MARKER_SHELL_SIZE / 2;

  return {
    logoSize,
    markerImageSize,
    markerTop,
  };
}
