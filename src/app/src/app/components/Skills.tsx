import { useState } from "react";
import { motion } from "motion/react";
import { Cpu, Lightbulb, Waves, Wrench } from "lucide-react";

import { skillSets, softSkills } from "../data/portfolio";
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

export function Skills() {
  const [currentTrack, setCurrentTrack] = useState<keyof typeof skillSets>("electrical");

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Skills</h1>
        <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
          Electrical and software tools, plus the working habits that show up consistently across projects.
        </p>
      </motion.section>

      <div className="inline-flex rounded-full border border-[color:var(--toggle-border)] bg-[var(--toggle-shell-bg)] p-1 shadow-[var(--shadow-soft)]">
        <Button
          size="sm"
          onClick={() => setCurrentTrack("electrical")}
          className={
            currentTrack === "electrical"
              ? "rounded-full bg-[var(--toggle-active-bg)] px-5 text-[var(--toggle-active-text)] hover:opacity-95"
              : "rounded-full bg-transparent px-5 text-[var(--toggle-shell-text)] shadow-none hover:bg-[var(--toggle-hover-bg)]"
          }
        >
          Electrical
        </Button>
        <Button
          size="sm"
          onClick={() => setCurrentTrack("software")}
          className={
            currentTrack === "software"
              ? "rounded-full bg-[var(--toggle-active-bg)] px-5 text-[var(--toggle-active-text)] hover:opacity-95"
              : "rounded-full bg-transparent px-5 text-[var(--toggle-shell-text)] shadow-none hover:bg-[var(--toggle-hover-bg)]"
          }
        >
          Software
        </Button>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
        className="rounded-[1.9rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex flex-wrap gap-3">
          {skillSets[currentTrack].map((skill) => (
            <span key={skill} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-4 py-2 text-sm text-[var(--chip-text)]">
              {skill}
            </span>
          ))}
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-3">
        {emphasisCards.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.06 }}
              className="rounded-[1.75rem] border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]"
            >
              <div className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)] shadow-[var(--shadow-button)]">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-5 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{item.title}</h2>
              <p className="mt-3 text-[0.98rem] leading-8 text-[var(--text-body)]">{item.detail}</p>
            </motion.article>
          );
        })}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="rounded-[1.9rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)] shadow-[var(--shadow-button)]">
            <Lightbulb className="size-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">Soft Skills</h3>
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
