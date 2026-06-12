import { motion } from "motion/react";

import { updateFeed } from "../data/portfolio";

export function Updates() {
  const feed = updateFeed;

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Updates</h1>
        <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
          A combined log of all project and team context updates — newest first.
        </p>
      </motion.section>

      <div className="space-y-6">
        {feed.map((entry, index) => (
          <motion.article
            key={entry.buildId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
            className="overflow-hidden rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)]"
          >
            <div className={entry.media ? (index % 2 === 1 ? "grid xl:grid-cols-[0.9fr_1.1fr]" : "grid xl:grid-cols-[1.1fr_0.9fr]") : ""}>
              <div className="space-y-5 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                      entry.orgId === "paradigm-engineering"
                        ? "bg-primary/10 text-primary"
                        : "bg-[var(--surface-4)] text-[var(--text-muted)]"
                    }`}
                  >
                    {entry.orgName}
                  </span>
                  {entry.week ? (
                    <span className="text-sm text-[var(--text-muted)]">{entry.week}</span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">{entry.period}</span>
                  )}
                </div>

                <h2 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                  {entry.title}
                </h2>

                <p className="text-[1rem] leading-8 text-[var(--text-soft)] sm:text-[1.04rem]">
                  {entry.summary}
                </p>

                <ul className="space-y-3">
                  {entry.bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-3 text-[1rem] leading-8 text-[var(--text-soft)]">
                      <span className="mt-3 size-2 shrink-0 rounded-full bg-[var(--text-muted)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2 pt-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[0.95rem] border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 font-mono text-[0.82rem] uppercase tracking-[0.08em] text-[var(--chip-text)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {entry.media ? (
                <div
                  className={`border-t border-[color:var(--outline-soft)] xl:border-t-0 ${
                    index % 2 === 1 ? "xl:order-first xl:border-r" : "xl:border-l"
                  }`}
                  style={{ background: entry.mediaBackground ?? "#0b1018" }}
                >
                  <div className="h-full min-h-[18rem] p-4 sm:p-5">
                    <img
                      src={entry.media}
                      alt={entry.title}
                      loading="lazy"
                      className="h-full w-full rounded-[1.25rem]"
                      style={{
                        objectFit: entry.mediaContain ? "contain" : "cover",
                        objectPosition: entry.mediaPosition ?? "center",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
