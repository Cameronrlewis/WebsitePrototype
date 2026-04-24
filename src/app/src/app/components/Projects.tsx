import { motion } from "motion/react";
import { ArrowRight, Orbit } from "lucide-react";

import {
  getOrganizationById,
  organizationKindLabel,
  projects,
} from "../data/portfolio";
import type { ProjectRecord } from "../data/portfolio";
import { OrganizationAvatar } from "./OrganizationAvatar";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";

interface ProjectsProps {
  onOpenProject: (project: ProjectRecord) => void;
  onOpenOrganization: (project: ProjectRecord) => void;
  viewMode: "all" | "featured";
  onViewModeChange: (viewMode: "all" | "featured") => void;
}

export function Projects({
  onOpenProject,
  onOpenOrganization,
  viewMode,
  onViewModeChange,
}: ProjectsProps) {
  const { theme } = useTheme();
  const visibleProjects = viewMode === "all" ? projects : projects.filter((project) => project.featured);

  return (
    <div className="space-y-7">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Projects</h1>
          <p className="mt-2 max-w-4xl text-base text-[var(--text-soft)] sm:text-lg">
            Hardware, firmware, and simulation projects built during coursework, design team work, and independent development.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-[color:var(--toggle-border)] bg-[var(--toggle-shell-bg)] p-1">
          <Button
            size="sm"
            onClick={() => onViewModeChange("all")}
            className={
              viewMode === "all"
                ? "rounded-full bg-[var(--toggle-active-bg)] px-5 text-[var(--toggle-active-text)] hover:brightness-95"
                : "rounded-full bg-transparent px-5 text-[var(--toggle-shell-text)] shadow-none hover:bg-[var(--toggle-hover-bg)]"
            }
          >
            All Projects
          </Button>
          <Button
            size="sm"
            onClick={() => onViewModeChange("featured")}
            className={
              viewMode === "featured"
                ? "rounded-full bg-[var(--toggle-active-bg)] px-5 text-[var(--toggle-active-text)] hover:brightness-95"
                : "rounded-full bg-transparent px-5 text-[var(--toggle-shell-text)] shadow-none hover:bg-[var(--toggle-hover-bg)]"
            }
          >
            Featured
          </Button>
        </div>
      </motion.section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleProjects.map((project, index) => (
          <motion.article
            key={project.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04 }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpenProject(project)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenProject(project);
                }
              }}
              className="flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-left shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <div
                className="relative h-56 overflow-hidden border-b border-[color:var(--outline-soft)]"
                style={{ background: project.cardBackground ?? "var(--surface-3)" }}
              >
                {project.cardImg || project.bannerImg ? (
                  <img
                    src={project.cardImg ?? project.bannerImg}
                    alt={project.title}
                    className="h-full w-full"
                    style={{
                      objectFit: project.cardContain ? "contain" : "cover",
                      objectPosition: project.cardImgPosition ?? "center",
                      transform: project.cardScale ? `scale(${project.cardScale})` : undefined,
                      transformOrigin: "center",
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_60%)]">
                    <div className="flex size-20 items-center justify-center rounded-[1.4rem] bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
                      <span className="text-3xl">{fallbackProjectGlyph(project)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                {(() => {
                  const organization = getOrganizationById(project.organizationId);

                  if (!organization) {
                    return null;
                  }

                  return (
                    <div className="mb-4 flex items-start justify-between gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenOrganization(project);
                        }}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <OrganizationAvatar organization={organization} size="sm" tone={theme === "dark" ? "dark" : "light"} />
                        <div className="min-w-0">
                          <p className="truncate text-[0.98rem] font-semibold text-[var(--text-strong)]">{organization.name}</p>
                          <p className="truncate text-xs text-[var(--text-soft)]">
                            {organization.role} · {organization.period}
                          </p>
                        </div>
                      </button>

                      <span className="rounded-full border border-[color:var(--chip-border)] bg-[var(--surface-1)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        {organizationKindLabel[organization.kind]}
                      </span>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[0.73rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                    <span>{project.category}</span>
                    {project.status ? <span className="text-[var(--text-muted)]">{project.status === "in-progress" ? "In Progress" : "Completed"}</span> : null}
                  </div>
                  <h2 className="text-[1.38rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--text-strong)]">{project.title}</h2>
                  <p className="text-[0.98rem] leading-7 text-[var(--text-soft)]">{truncateCopy(project.description, 170)}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {project.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenOrganization(project);
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                  >
                    <span>Open context</span>
                    <ArrowRight className="size-4" />
                  </button>

                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                    <span>Open project</span>
                    {project.viewer3d ? <Orbit className="size-4" /> : <ArrowRight className="size-4" />}
                  </div>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

function truncateCopy(copy: string, maxLength: number) {
  if (copy.length <= maxLength) {
    return copy;
  }

  return `${copy.slice(0, maxLength).trimEnd()}...`;
}

function fallbackProjectGlyph(project: ProjectRecord) {
  if (project.category === "Python") {
    return "🏓";
  }

  if (project.viewer3d) {
    return "◫";
  }

  if (project.reportAsset) {
    return "✎";
  }

  return "⋯";
}
