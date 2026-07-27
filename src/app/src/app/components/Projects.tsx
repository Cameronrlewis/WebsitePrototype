import { motion } from "motion/react";
import { ArrowRight, Orbit } from "lucide-react";

import {
  getOrganizationById,
  organizationKindLabel,
  projects,
} from "../data/portfolio";
import type { ProjectRecord } from "../data/portfolio";
import { OrganizationAvatar } from "./OrganizationAvatar";
import { SectionHeader } from "./SectionHeader";
import { FORCE_CARD_SKELETONS, ProjectCardSkeleton, SkeletonImage } from "./Skeletons";
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
      <SectionHeader
        index="03"
        kicker="Projects"
        title="Projects"
        intro="Hardware, firmware, and simulation projects built during coursework, design team work, and independent development."
        action={
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
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ?skeleton=cards only - swaps the real cards for their placeholders. */}
        {FORCE_CARD_SKELETONS
          ? visibleProjects.map((project, index) => (
              <div key={project.id} className={index === 0 ? "md:col-span-2" : ""}>
                <ProjectCardSkeleton tall={index === 0} />
              </div>
            ))
          : null}
        {FORCE_CARD_SKELETONS ? null : visibleProjects.map((project, index) => {
          const organization = getOrganizationById(project.organizationId);

          return (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className={index === 0 ? "md:col-span-2" : ""}
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
                onMouseMove={project.viewer3d ? tiltCard : undefined}
                onMouseLeave={project.viewer3d ? resetTilt : undefined}
                className="group relative flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-left shadow-[var(--shadow-card)] outline-none transition-transform duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                {project.viewer3d ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle at var(--glint-x, 50%) var(--glint-y, 50%), rgba(255, 255, 255, 0.13), transparent 55%)",
                    }}
                  />
                ) : null}
                <div
                  className={`relative overflow-hidden border-b border-[color:var(--outline-soft)] ${index === 0 ? "h-56 md:h-80" : "h-56"}`}
                  style={{ background: project.cardBackground ?? "var(--surface-3)" }}
                >
                  {project.cardImg || project.bannerImg ? (
                    <SkeletonImage
                      src={project.cardImg ?? project.bannerImg}
                      alt={project.title}
                      loading="lazy"
                      className={`h-full w-full ${project.hoverImg ? "transition-opacity duration-500 group-hover:opacity-0" : ""}`}
                      style={{
                        objectFit: project.cardContain ? "contain" : "cover",
                        objectPosition: project.cardImgPosition ?? "center",
                        transform: project.cardScale ? `scale(${project.cardScale})` : undefined,
                        transformOrigin: "center",
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_60%)]">
                      <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
                        <span className="text-3xl">{fallbackProjectGlyph(project)}</span>
                      </div>
                    </div>
                  )}

                  {project.hoverImg ? (
                    <>
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        style={{ background: project.hoverBackground ?? "#f5f4ef" }}
                      >
                        <img
                          src={project.hoverImg}
                          alt=""
                          loading="lazy"
                          className="h-full w-full"
                          style={{
                            objectFit: "contain",
                            objectPosition: project.hoverImgPosition ?? "center",
                            transform: project.hoverScale ? `scale(${project.hoverScale})` : undefined,
                            transformOrigin: "center",
                          }}
                        />
                      </div>
                      <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-primary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground opacity-0 shadow-[var(--shadow-button)] transition-opacity delay-150 duration-300 group-hover:opacity-100">
                        Schematic
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {organization ? (
                    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-3">
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
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[0.73rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                      <span>{project.category}</span>
                      {project.status ? <span className="text-[var(--text-muted)]">{project.status === "in-progress" ? "In Progress" : "Completed"}</span> : null}
                    </div>
                    <h2 className="font-display text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{project.title}</h2>
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
                    {organization ? (
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
                    ) : <span />}

                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                      <span>Open project</span>
                      {project.viewer3d ? <Orbit className="size-4" /> : <ArrowRight className="size-4" />}
                    </div>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

// 3D "pick up the board" tilt — only applied to cards with a physical PCB (viewer3d).
function tiltCard(event: React.MouseEvent<HTMLDivElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width - 0.5;
  const py = (event.clientY - rect.top) / rect.height - 0.5;

  el.style.transform = `perspective(950px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-3px)`;
  el.style.setProperty("--glint-x", `${((px + 0.5) * 100).toFixed(1)}%`);
  el.style.setProperty("--glint-y", `${((py + 0.5) * 100).toFixed(1)}%`);
}

function resetTilt(event: React.MouseEvent<HTMLDivElement>) {
  event.currentTarget.style.transform = "";
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
