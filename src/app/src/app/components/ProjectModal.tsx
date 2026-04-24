import { ArrowRight, ExternalLink, FileText, Github, Layers3, Orbit, Sparkles } from "lucide-react";

import {
  getOrganizationById,
  organizationKindLabel,
  type ProjectRecord,
} from "../data/portfolio";
import { OrganizationAvatar } from "./OrganizationAvatar";
import { useTheme } from "./ThemeProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
interface ProjectModalProps {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOrganization: (project: ProjectRecord) => void;
  onOpen3D: (project: ProjectRecord) => void;
  onOpenReport: (project: ProjectRecord) => void;
  onOpenBom: (project: ProjectRecord) => void;
}

function renderParagraphs(copy?: string) {
  if (!copy) {
    return null;
  }

  return copy.split("\n\n").map((paragraph) => (
    <p key={paragraph.slice(0, 24)} className="text-[0.98rem] leading-8 text-[var(--text-soft)]">
      {paragraph}
    </p>
  ));
}

export function ProjectModal({
  project,
  open,
  onOpenChange,
  onOpenOrganization,
  onOpen3D,
  onOpenReport,
  onOpenBom,
}: ProjectModalProps) {
  const { theme } = useTheme();

  if (!project) {
    return null;
  }

  const hasHeroMedia = Boolean(project.bannerImg || project.cardImg);
  const organization = getOrganizationById(project.organizationId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1260px,calc(100vw-1rem))] overflow-hidden rounded-[2rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1260px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="min-h-full">
              <div className="relative h-[26rem] overflow-hidden border-b border-[color:var(--outline-soft)] bg-[var(--surface-3)] sm:h-[30rem] lg:h-[34rem]">
                {hasHeroMedia ? (
                  <div
                    className="h-full w-full"
                    style={{
                      background: project.modalBackground ?? "var(--surface-3)",
                    }}
                  >
                    <img
                      src={project.bannerImg ?? project.cardImg}
                      alt={project.title}
                      className="h-full w-full"
                      style={{
                        objectFit: project.modalContain ? "contain" : "cover",
                        objectPosition: project.modalImgPosition ?? project.cardImgPosition ?? "center",
                        transform: project.modalScale ? `scale(${project.modalScale})` : undefined,
                        transformOrigin: "center",
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                    <Orbit className="size-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#11131e]/55 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-primary/10 bg-primary text-primary-foreground">{project.category}</Badge>
                    {project.status ? (
                      <Badge className="border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-body)]">
                        {project.status === "in-progress" ? "In Progress" : "Completed"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-8 p-6 sm:p-8 lg:p-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
                  <div className="space-y-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--outline-soft)] bg-[var(--surface-3)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      <Sparkles className="size-3.5" />
                      Project Deep Dive
                    </div>
                    <DialogTitle className="text-4xl leading-tight tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">
                      {project.title}
                    </DialogTitle>
                    <DialogDescription className="max-w-4xl text-[1.02rem] leading-8 text-[var(--text-soft)] sm:text-[1.08rem]">
                      {project.description}
                    </DialogDescription>
                  </div>

                  <div className="space-y-5 rounded-[1.5rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-soft)]">
                    {organization ? (
                      <div className="rounded-[1.35rem] border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-4 text-[var(--text-strong)] shadow-[var(--shadow-soft)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <OrganizationAvatar organization={organization} size="sm" tone={theme === "dark" ? "dark" : "light"} />
                            <div className="min-w-0">
                              <p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">{organization.name}</p>
                              <p className="truncate text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                {organization.role} · {organization.period}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-[color:var(--org-badge-border)] bg-[var(--org-badge-bg)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--org-badge-text)]">
                            {organizationKindLabel[organization.kind]}
                          </span>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">{organization.overview[0]}</p>

                        <Button
                          variant="outline"
                          className="mt-4 rounded-[0.95rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-4)]"
                          onClick={() => onOpenOrganization(project)}
                        >
                          Open {organizationKindLabel[organization.kind]} Context
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    ) : null}

                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Project Tags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--chip-text)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {project.github ? (
                        <Button asChild className="rounded-[1rem] shadow-[var(--shadow-button)]">
                          <a href={project.github} target="_blank" rel="noreferrer">
                            <Github className="size-4" />
                            GitHub
                          </a>
                        </Button>
                      ) : null}
                      {project.demo ? (
                        <Button asChild variant="outline" className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]">
                          <a href={project.demo} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" />
                            Demo
                          </a>
                        </Button>
                      ) : null}
                      {project.reportAsset ? (
                        <Button
                          variant="outline"
                          className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                          onClick={() => onOpenReport(project)}
                        >
                          <FileText className="size-4" />
                          View Report
                        </Button>
                      ) : null}
                      {project.viewer3d ? (
                        <>
                          <Button
                            variant="outline"
                            className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                            onClick={() => onOpen3D(project)}
                          >
                            <Orbit className="size-4" />
                            Explore 3D Board
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                            onClick={() => onOpenBom(project)}
                          >
                            <Layers3 className="size-4" />
                            Interactive BOM
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {project.viewer3d ? (
                  <section className="space-y-4">
                    <h3 className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">3D Board Viewer</h3>
                    <button
                      type="button"
                      onClick={() => onOpen3D(project)}
                      className="group block w-full overflow-hidden rounded-[1.5rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-left shadow-[var(--shadow-strong)] transition-transform duration-300 hover:-translate-y-1"
                    >
                      <div className="relative aspect-[16/9]">
                        {hasHeroMedia ? (
                          <img
                            src={project.cardImg ?? project.bannerImg}
                            alt={`${project.title} 3D preview`}
                            className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.02]"
                            style={{ objectPosition: project.cardImgPosition ?? "center" }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_58%)]">
                            <Orbit className="size-20 text-white/80" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-6 py-5 text-white">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-white/60">Interactive Preview</p>
                            <p className="mt-1 text-lg font-semibold">Click to explore 3D model</p>
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                            Open viewer
                            <ArrowRight className="size-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </section>
                ) : null}

                {project.designDecisions ? (
                  <section className="space-y-4">
                    <h3 className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Design Decisions</h3>
                    <div className="space-y-4">{renderParagraphs(project.designDecisions)}</div>
                  </section>
                ) : null}

                <section className="space-y-4">
                  <h3 className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Challenges</h3>
                  <div className="space-y-4">{renderParagraphs(project.challenges)}</div>
                </section>

                <section className="space-y-4 pb-8">
                  <h3 className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Takeaways</h3>
                  <div className="space-y-4">{renderParagraphs(project.takeaways)}</div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
