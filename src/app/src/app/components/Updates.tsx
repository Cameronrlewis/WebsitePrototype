import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { organizations } from "../data/portfolio";
import type { OrganizationRecord } from "../data/portfolio";

interface UpdatesProps {
  onOpenOrganization: (orgId: string) => void;
}

const MONTH_MAP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function parsePeriodStart(period: string): number {
  const token = period.split("—")[0].trim();
  const monthMatch = token.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[1]] ?? 1;
    return parseInt(monthMatch[2]) * 100 + month;
  }
  const yearMatch = token.match(/^(\d{4})/);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 100;
  }
  return 0;
}

interface UpdateEntry {
  org: OrganizationRecord;
  buildId: string;
  title: string;
  period: string;
  summary: string;
  tags: string[];
  sortKey: number;
}

const SOURCE_ORG_IDS = ["paradigm-engineering", "personal-lab"];

function buildUpdateEntries(): UpdateEntry[] {
  const entries: UpdateEntry[] = [];
  for (const org of organizations) {
    if (!SOURCE_ORG_IDS.includes(org.id)) continue;
    for (const build of org.builds) {
      entries.push({
        org,
        buildId: build.id,
        title: build.title,
        period: build.period,
        summary: build.summary,
        tags: build.tags,
        sortKey: parsePeriodStart(build.period),
      });
    }
  }
  return entries.sort((a, b) => b.sortKey - a.sortKey);
}

const ORG_LABEL: Record<string, string> = {
  "paradigm-engineering": "Paradigm Engineering",
  "personal-lab": "Personal Lab",
};

export function Updates({ onOpenOrganization }: UpdatesProps) {
  const entries = buildUpdateEntries();

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Updates</h1>
        <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
          A running log of project activity across Paradigm Engineering and my personal builds.
        </p>
      </motion.section>

      <div className="relative space-y-0">
        <div className="absolute left-[20px] top-0 hidden h-full w-px bg-[var(--text-strong)] lg:block" />

        {entries.map((entry, index) => (
          <motion.article
            key={entry.buildId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="relative pb-6 last:pb-0 lg:pl-16"
          >
            {/* Timeline dot */}
            <div
              className="absolute left-0 hidden size-10 items-center justify-center rounded-full border-2 border-[color:var(--text-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)] lg:flex"
              style={{ top: "24px" }}
            >
              {entry.org.logo ? (
                <img src={entry.org.logo} alt="" className="size-6 object-contain" />
              ) : (
                <span className="text-xs font-semibold text-[var(--text-strong)]">
                  {(entry.org.monogram ?? entry.org.name).slice(0, 2)}
                </span>
              )}
            </div>

            <div className="rounded-[18px] border-2 border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-0.5 text-xs font-medium text-[var(--chip-text)]">
                      {ORG_LABEL[entry.org.id]}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">{entry.period}</span>
                  </div>
                  <h2 className="text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                    {entry.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenOrganization(entry.org.id)}
                  className="inline-flex shrink-0 items-center gap-2 self-start rounded-[0.85rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-1)]"
                >
                  Open context
                  <ArrowRight className="size-4" />
                </button>
              </div>

              <p className="mt-3 text-[0.98rem] leading-8 text-[var(--text-soft)]">{entry.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
