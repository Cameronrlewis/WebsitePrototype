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
 * chip, a Space-Grotesk display title, and an optional intro.
 * Used by every scroll section so the page reads as one designed system.
 *
 * The whole block sits on a backdrop-blurred plate (`--header-plate`, more
 * opaque than `--surface-1` on purpose) because `CircuitTrace` draws its copper
 * mesh across the full content column on lg+ — bare text over those traces was
 * unreadable. The kicker is a chip and the rule is a primary-tinted gradient so
 * neither competes with the traces the way the old `--outline-soft` hairline did.
 */
export function SectionHeader({ index, kicker, title, intro, action }: SectionHeaderProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5 rounded-2xl border border-[color:var(--header-plate-border)] bg-[var(--header-plate)] px-5 py-5 shadow-[var(--shadow-soft)] backdrop-blur-md sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-4">
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--header-kicker-text)]">
            {index ? `${index} · ` : ""}
            {kicker}
          </span>
          <span
            className="h-px flex-1 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--primary)_55%,transparent),color-mix(in_srgb,var(--outline-strong)_80%,transparent))]"
            aria-hidden="true"
          />
        </div>
        <h1 className="mt-3.5 font-display text-[2rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)] sm:text-[2.55rem]">
          {title}
        </h1>
        {intro ? (
          <p className="mt-2.5 max-w-2xl text-base leading-relaxed text-[var(--text-body)]">
            {intro}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.section>
  );
}
