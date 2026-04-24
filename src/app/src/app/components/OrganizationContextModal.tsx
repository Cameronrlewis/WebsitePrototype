import { ArrowRight } from "lucide-react";

import {
  getProjectBySlug,
  organizationKindLabel,
  type OrganizationRecord,
  type ProjectRecord,
} from "../data/portfolio";
import { OrganizationAvatar } from "./OrganizationAvatar";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

interface OrganizationContextModalProps {
  organization: OrganizationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProject: (project: ProjectRecord) => void;
}

export function OrganizationContextModal({
  organization,
  open,
  onOpenChange,
  onOpenProject,
}: OrganizationContextModalProps) {
  const { theme } = useTheme();

  if (!organization) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[96vh] max-h-[96vh] max-w-[min(1380px,calc(100vw-1.25rem))] overflow-hidden rounded-[2rem] border-[color:var(--org-border)] bg-[var(--surface-1)] p-0 text-[var(--org-text)] shadow-[var(--shadow-strong)] sm:max-w-[min(1380px,calc(100vw-2rem))]"
        overlayClassName="bg-[var(--org-overlay)] backdrop-blur-md"
        closeClassName="border-[color:var(--org-close-border)] bg-[var(--org-close-bg)] text-[var(--org-close-text)] shadow-none hover:bg-[var(--surface-4)]"
      >
        <div className="h-full overflow-y-auto bg-[var(--org-shell)]">
          <div className="mx-auto max-w-[1220px] px-6 py-8 sm:px-8 sm:py-10">
            <header className="space-y-6 border-b border-[color:var(--org-border)] pb-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 sm:gap-5">
                  <OrganizationAvatar organization={organization} size="lg" tone={theme === "dark" ? "dark" : "light"} />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[2.6rem] font-semibold tracking-[-0.05em] text-[var(--org-text)] sm:text-[3.25rem]">
                        {organization.name}
                      </h2>
                      <span className="rounded-full border border-[color:var(--org-badge-border)] bg-[var(--org-badge-bg)] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--org-badge-text)]">
                        {organizationKindLabel[organization.kind]}
                      </span>
                    </div>
                    <p className="text-lg text-[var(--org-text-soft)] sm:text-[1.35rem]">
                      {organization.role} · {organization.period}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {organization.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[0.95rem] border border-[color:var(--org-chip-border)] bg-[var(--org-chip-bg)] px-4 py-2 font-mono text-[0.92rem] uppercase tracking-[0.08em] text-[var(--org-chip-text)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <section className="space-y-8 py-10">
              <div className="space-y-5">
                <h3 className="text-[1.6rem] font-medium tracking-[-0.03em] text-[var(--org-text)]">Overview</h3>
                <div className="max-w-[78rem] space-y-5 text-[1.05rem] leading-9 text-[var(--org-text-soft)] sm:text-[1.12rem]">
                  {organization.overview.map((paragraph) => (
                    <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                  ))}
                </div>
              </div>

              <div className="space-y-5 pt-4">
                <h3 className="text-[1.6rem] font-medium tracking-[-0.03em] text-[var(--org-text)]">What I Built</h3>

                <div className="space-y-6">
                  {organization.builds.map((build) => {
                    const linkedProject = build.projectSlug ? getProjectBySlug(build.projectSlug) : null;

                    return (
                      <article
                        key={build.id}
                        className="overflow-hidden rounded-[1.8rem] border border-[color:var(--org-border)] bg-[var(--org-surface)] shadow-[var(--shadow-soft)]"
                      >
                        <div className={`grid gap-0 ${build.media ? "xl:grid-cols-[1.08fr_0.92fr]" : ""}`}>
                          <div className="space-y-6 p-6 sm:p-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h4 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[var(--org-text)]">
                                  {build.title}
                                </h4>
                                <p className="mt-2 text-sm uppercase tracking-[0.22em] text-[var(--org-text-soft)]">
                                  {build.period}
                                </p>
                              </div>

                              {linkedProject ? (
                                <Button
                                  variant="outline"
                                  className="rounded-[0.95rem] border-[color:var(--org-chip-border)] bg-[var(--org-chip-bg)] text-[var(--org-text)] hover:bg-[var(--surface-4)]"
                                  onClick={() => onOpenProject(linkedProject)}
                                >
                                  Open Project
                                  <ArrowRight className="size-4" />
                                </Button>
                              ) : null}
                            </div>

                            <p className="text-[1rem] leading-8 text-[var(--org-text-soft)] sm:text-[1.04rem]">
                              {build.summary}
                            </p>

                            <ul className="space-y-3">
                              {build.bullets.map((bullet) => (
                                <li key={bullet.slice(0, 32)} className="flex gap-3 text-[1rem] leading-8 text-[var(--org-text-soft)]">
                                  <span className="mt-3 size-2 shrink-0 rounded-full bg-[var(--org-bullet)]" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="flex flex-wrap gap-2">
                              {build.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-[0.95rem] border border-[color:var(--org-chip-border)] bg-[var(--org-chip-bg)] px-3 py-1.5 font-mono text-[0.88rem] uppercase tracking-[0.08em] text-[var(--org-chip-text)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {build.media ? (
                            <div
                              className="border-t border-[color:var(--org-border)] xl:border-t-0 xl:border-l"
                              style={{
                                background: build.mediaBackground ?? "#0b1018",
                              }}
                            >
                              <div className="h-full min-h-[18rem] p-4 sm:p-5">
                                <img
                                  src={build.media}
                                  alt={build.title}
                                  className="h-full w-full rounded-[1.25rem]"
                                  style={{
                                    objectFit: build.mediaContain ? "contain" : "cover",
                                    objectPosition: build.mediaPosition ?? "center",
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
