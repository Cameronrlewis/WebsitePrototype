import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Cpu, Lightbulb, Waves, Wrench } from "lucide-react";

import { skillSets, softSkills } from "../data/portfolio";
import { SectionHeader } from "./SectionHeader";
import { Button } from "./ui/button";

const emphasisCards = [
  {
    icon: Cpu,
    title: "Embedded Systems",
    detail: "Microcontrollers, board bring-up, communication buses, and firmware that supports the hardware stack.",
  },
  {
    icon: Waves,
    title: "Circuits & Power",
    detail: "Analog design, power electronics, and the bench work required to validate what is on the schematic.",
  },
  {
    icon: Wrench,
    title: "Documentation",
    detail: "Schematics, build notes, test procedures, and the detail work that keeps projects buildable for a team.",
  },
];

const skillTracks: { id: keyof typeof skillSets; label: string }[] = [
  { id: "electrical", label: "Electrical" },
  { id: "software", label: "Software" },
];

const chipClassName =
  "rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-4 py-2 text-sm text-[var(--chip-text)]";

export function Skills() {
  const [currentTrack, setCurrentTrack] = useState<keyof typeof skillSets>("electrical");
  const prefersReducedMotion = useReducedMotion();
  const chipStagger = prefersReducedMotion ? 0 : 0.045;

  return (
    <div className="space-y-6">
      <SectionHeader
        index="04"
        kicker="Skills"
        title="Skills"
        intro="Electrical and software tools, plus the working habits that show up consistently across projects."
      />

      <div
        role="tablist"
        aria-label="Skill tracks"
        className="inline-flex rounded-full border border-[color:var(--toggle-border)] bg-[var(--toggle-shell-bg)] p-1 shadow-[var(--shadow-soft)]"
      >
        {skillTracks.map((track) => {
          const isActive = currentTrack === track.id;

          return (
            <div key={track.id} className="relative">
              {isActive ? (
                <motion.div
                  layoutId="skills-track-pill"
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className="absolute inset-0 rounded-full bg-[var(--toggle-active-bg)]"
                />
              ) : null}
              <Button
                size="sm"
                role="tab"
                id={`skills-tab-${track.id}`}
                aria-selected={isActive}
                aria-controls="skills-panel"
                onClick={() => setCurrentTrack(track.id)}
                className={
                  isActive
                    ? "relative z-10 rounded-full bg-transparent px-5 text-[var(--toggle-active-text)] shadow-none transition-colors hover:bg-transparent"
                    : "relative z-10 rounded-full bg-transparent px-5 text-[var(--toggle-shell-text)] shadow-none transition-colors hover:bg-[var(--toggle-hover-bg)]"
                }
              >
                {track.label}
              </Button>
            </div>
          );
        })}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
        className="rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        {/* items-start: without it the grid row is pinned to max(electrical, software) and the
            shorter track is stretched, which then inflates its chips. */}
        <div className="grid items-start">
          {/* One invisible copy of the inactive track: stacked with the live row it pins the grid
              row to max(electrical, software) so the panel height is identical on switch. */}
          {skillTracks
            .filter((track) => track.id !== currentTrack)
            .map((track) => (
              <div
                key={track.id}
                aria-hidden
                className="col-start-1 row-start-1 invisible flex select-none flex-wrap content-start items-start gap-3 pointer-events-none"
              >
                {skillSets[track.id].map((skill) => (
                  <span key={skill} className={chipClassName}>
                    {skill}
                  </span>
                ))}
              </div>
            ))}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentTrack}
              role="tabpanel"
              id="skills-panel"
              aria-labelledby={`skills-tab-${currentTrack}`}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="col-start-1 row-start-1 flex flex-wrap content-start items-start gap-3"
            >
              {skillSets[currentTrack].map((skill, index) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, y: 8, x: -6 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.28, delay: index * chipStagger, ease: [0.22, 1, 0.36, 1] }}
                  className={chipClassName}
                >
                  {skill}
                </motion.span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr_1fr]">
        {emphasisCards.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.06 }}
              className={
                index === 0
                  ? "rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-7 shadow-[var(--shadow-card)]"
                  : "rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]"
              }
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)] shadow-[var(--shadow-button)]">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-5 font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">{item.title}</h2>
              <p className="mt-3 text-[0.98rem] leading-8 text-[var(--text-body)]">{item.detail}</p>
            </motion.article>
          );
        })}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)] shadow-[var(--shadow-button)]">
            <Lightbulb className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--text-strong)]">Soft Skills</h3>
            <p className="text-sm text-[var(--text-soft)]">The habits that keep technical work moving well inside a team.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {softSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-4 py-2 text-sm text-[var(--chip-text)]">
              {skill}
            </span>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
