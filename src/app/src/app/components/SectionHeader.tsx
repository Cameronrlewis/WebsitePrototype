import type { ReactNode } from "react";
import { motion } from "motion/react";

interface SectionHeaderProps {
  /** Two-digit section index, e.g. "01". Omit for un-numbered headers. */
  index?: string;
  /** Short uppercase label shown in mono, e.g. "EDUCATION". */
  kicker: string;
  /** Display title. */
  title: string;
  /** Optional supporting line under the title. */
  intro?: string;
  /** Optional right-aligned slot (e.g. a view toggle). */
  action?: ReactNode;
}

/**
 * Shared "technical editorial" section header: a JetBrains-Mono numbered kicker
 * with a hairline rule, a Space-Grotesk display title, and an optional intro.
 * Used by every scroll section so the page reads as one designed system.
 */
export function SectionHeader({ index, kicker, title, intro, action }: SectionHeaderProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap font-mono text-xs font-medium uppercase tracking-[0.28em] text-primary">
            {index ? `${index} · ` : ""}
            {kicker}
          </span>
          <span className="h-px flex-1 bg-[var(--outline-soft)]" aria-hidden="true" />
        </div>
        <h1 className="mt-3 font-display text-[2rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)] sm:text-[2.55rem]">
          {title}
        </h1>
        {intro ? (
          <p className="mt-2.5 max-w-2xl text-base leading-relaxed text-[var(--text-soft)]">
            {intro}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.section>
  );
}
