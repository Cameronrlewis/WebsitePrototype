import { motion } from "motion/react";

import { organizations } from "../data/portfolio";

const SOURCE_ORG_IDS = ["paradigm-engineering", "personal-lab"];

const MONTH_MAP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function parseWeekSortKey(week: string): number {
  // "Apr 12th - 18th, 2026" → extract month, start day, year
  const m = week.match(/^([A-Za-z]+)\s+(\d+)/);
  const y = week.match(/(\d{4})$/);
  if (!m || !y) return 0;
  const month = MONTH_MAP[m[1]] ?? 1;
  return parseInt(y[1]) * 10000 + month * 100 + parseInt(m[2]);
}

function parsePeriodStart(period: string): number {
  const token = period.split("—")[0].trim();
  const monthMatch = token.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthMatch) {
    return parseInt(monthMatch[2]) * 10000 + (MONTH_MAP[monthMatch[1]] ?? 1) * 100;
  }
  const yearMatch = token.match(/^(\d{4})/);
  if (yearMatch) return parseInt(yearMatch[1]) * 10000;
  return 0;
}

interface FeedEntry {
  orgId: string;
  orgName: string;
  buildId: string;
  title: string;
  period: string;
  week?: string;
  summary: string;
  bullets: string[];
  tags: string[];
  media?: string;
  mediaBackground?: string;
  mediaContain?: boolean;
  mediaPosition?: string;
  sortKey: number;
}

function buildFeed(): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const org of organizations) {
    if (!SOURCE_ORG_IDS.includes(org.id)) continue;
    for (const build of org.builds) {
      const sortKey = build.week
        ? parseWeekSortKey(build.week)
        : parsePeriodStart(build.period);
      entries.push({
        orgId: org.id,
        orgName: org.name,
        buildId: build.id,
        title: build.title,
        period: build.period,
        week: build.week,
        summary: build.summary,
        bullets: build.bullets,
        tags: build.tags,
        media: build.media,
        mediaBackground: build.mediaBackground,
        mediaContain: build.mediaContain,
        mediaPosition: build.mediaPosition,
        sortKey,
      });
    }
  }
  return entries.sort((a, b) => b.sortKey - a.sortKey);
}

export function Updates() {
  const feed = buildFeed();

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
            <div className={entry.media ? "grid xl:grid-cols-[1.1fr_0.9fr]" : ""}>
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
                  {entry.bullets.map((bullet) => (
                    <li key={bullet.slice(0, 32)} className="flex gap-3 text-[1rem] leading-8 text-[var(--text-soft)]">
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
                  className="border-t border-[color:var(--outline-soft)] xl:border-t-0 xl:border-l"
                  style={{ background: entry.mediaBackground ?? "#0b1018" }}
                >
                  <div className="h-full min-h-[18rem] p-4 sm:p-5">
                    <img
                      src={entry.media}
                      alt={entry.title}
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
