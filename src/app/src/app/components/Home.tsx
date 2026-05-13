import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  GraduationCap,
  Mail,
  MapPin,
  Orbit,
  Sparkles,
} from "lucide-react";

import {
  featuredBoardProjects,
  getOrganizationById,
  organizationKindLabel,
  profile,
  socialLinks,
  stats,
} from "../data/portfolio";
import type { PageId, ProjectRecord } from "../data/portfolio";
import { MonogramText } from "./MonogramText";
import { OrganizationAvatar } from "./OrganizationAvatar";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";

interface HomeProps {
  onNavigate: (page: PageId) => void;
  onOpenProject: (project: ProjectRecord) => void;
  onOpenOrganization: (project: ProjectRecord) => void;
  onOpenResume: () => void;
  onOpen3D: (project: ProjectRecord) => void;
}

const statIcons = {
  GPA: GraduationCap,
  Projects: FolderKanban,
  Experience: Briefcase,
  "Grad Date": Sparkles,
} as const;

const HEADSHOT = "/portfolio/assets/headshot.jpg";

export function Home({ onNavigate, onOpenProject, onOpenOrganization, onOpenResume, onOpen3D }: HomeProps) {
  const { theme } = useTheme();
  const [typedText, setTypedText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeBoardIndex, setActiveBoardIndex] = useState(0);

  const currentPhrase = useMemo(
    () => profile.typedPhrases[phraseIndex % profile.typedPhrases.length],
    [phraseIndex],
  );
  const activeProject = featuredBoardProjects[activeBoardIndex] ?? featuredBoardProjects[0] ?? null;
  const featuredOrganization = activeProject ? getOrganizationById(activeProject.organizationId) : null;

  useEffect(() => {
    const speed = isDeleting ? 36 : 58;
    const timeout = window.setTimeout(() => {
      if (!isDeleting && typedText.length < currentPhrase.length) {
        setTypedText(currentPhrase.slice(0, typedText.length + 1));
        return;
      }

      if (!isDeleting && typedText.length === currentPhrase.length) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && typedText.length > 0) {
        setTypedText(currentPhrase.slice(0, typedText.length - 1));
        return;
      }

      setIsDeleting(false);
      setPhraseIndex((value) => value + 1);
    }, typedText === currentPhrase && !isDeleting ? 1300 : speed);

    return () => window.clearTimeout(timeout);
  }, [currentPhrase, isDeleting, typedText]);

  useEffect(() => {
    setActiveBoardIndex((value) => {
      if (featuredBoardProjects.length === 0) {
        return 0;
      }

      return Math.min(value, featuredBoardProjects.length - 1);
    });
  }, []);

  const cycleFeaturedBoard = (direction: -1 | 1) => {
    if (featuredBoardProjects.length <= 1) {
      return;
    }

    setActiveBoardIndex((value) => (value + direction + featuredBoardProjects.length) % featuredBoardProjects.length);
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3.1rem]">
            Hello, I&apos;m {profile.name}.
          </h1>
          <p className="mt-2 text-base text-[var(--text-soft)] sm:text-lg">
            {typedText}
            <span className="ml-1 inline-block h-5 w-px animate-pulse bg-primary/60 align-[-2px]" />
          </p>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.04 }}
        className="overflow-hidden rounded-[2rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]"
      >
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex flex-1 flex-col gap-5 p-6 lg:flex-row lg:items-start">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground shadow-[var(--shadow-button)]">
              <MonogramText value={profile.initials} />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">About Me</h2>
              <p className="mt-3 max-w-4xl text-[1rem] leading-8 text-[var(--text-soft)] sm:text-[1.05rem]">
                {profile.about[0]}
              </p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-body)]">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  {profile.location}
                </span>
                <a href={socialLinks[0].href} className="flex items-center gap-2 transition-colors hover:text-[var(--text-strong)]">
                  <Mail className="size-4" />
                  {socialLinks[0].value}
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={socialLinks[1].href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[0.85rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                >
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  GitHub
                </a>
                <a
                  href={socialLinks[2].href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[0.85rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                >
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  LinkedIn
                </a>
                <button
                  type="button"
                  onClick={onOpenResume}
                  className="inline-flex items-center gap-2 rounded-[0.85rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                >
                  <Download className="size-4 shrink-0" />
                  My Resume
                </button>
              </div>
            </div>
          </div>

          <div className="relative w-full shrink-0 overflow-hidden lg:w-56 xl:w-64">
            <div className="relative h-56 w-full lg:hidden">
              <img
                src={HEADSHOT}
                alt={profile.name}
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/60 to-transparent" />
            </div>
            <div className="absolute inset-0 hidden lg:block">
              <img
                src={HEADSHOT}
                alt={profile.name}
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--surface-1)] to-transparent" />
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = statIcons[stat.label as keyof typeof statIcons] ?? Sparkles;

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.08 + index * 0.05 }}
              className="rounded-[1.6rem] border border-[color:var(--outline-soft)] bg-[var(--surface-3)] p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--text-muted)]">{stat.label}</p>
                  <div className="mt-1 text-[2.05rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{stat.value}</div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{stat.detail}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-4)] text-[var(--text-strong)]">
                  <Icon className="size-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.12 }}
        className="rounded-[2rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        {activeProject ? (
          <>
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground shadow-[var(--shadow-button)]">
                  <Sparkles className="size-3.5" />
                  Featured Board
                </span>
                <span className="text-[var(--text-muted)]">{activeProject.category}</span>
              </div>

              {featuredBoardProjects.length > 1 ? (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => cycleFeaturedBoard(-1)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                    aria-label="Previous featured board"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleFeaturedBoard(1)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                    aria-label="Next featured board"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <button
                type="button"
                onClick={() => onOpen3D(activeProject)}
                className="group block w-full overflow-hidden rounded-[1.75rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-left shadow-[var(--shadow-strong)]"
              >
                <div className="relative min-h-[18rem] overflow-hidden lg:min-h-[22rem]">
                  {(activeProject.cardImg ?? activeProject.bannerImg) ? (
                    <div
                      className="h-full w-full"
                      style={{ background: activeProject.cardBackground ?? "#0c0c14" }}
                    >
                      <img
                        src={activeProject.cardImg ?? activeProject.bannerImg}
                        alt={`${activeProject.title} preview`}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]"
                        style={{
                          objectFit: activeProject.cardContain ? "contain" : "cover",
                          objectPosition: activeProject.cardImgPosition ?? "center",
                          transform: activeProject.cardScale ? `scale(${activeProject.cardScale})` : undefined,
                          transformOrigin: "center",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_58%)]">
                      <Orbit className="size-20 text-white/80" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-6 py-5 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/60">Interactive Preview</p>
                      <p className="mt-1 text-lg font-semibold">Click to view 3D model</p>
                      <p className="mt-2 text-sm text-white/78">Open the board viewer directly from the home page.</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                      Open viewer
                      <Orbit className="size-4" />
                    </span>
                  </div>
                </div>
              </button>

              <div className="max-w-xl">
                <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.05em] text-[var(--text-strong)] sm:text-[2.35rem]">
                  {activeProject.title}
                </h2>

                {featuredOrganization ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenOrganization(activeProject)}
                      className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-1)]"
                    >
                      <OrganizationAvatar organization={featuredOrganization} size="sm" tone={theme === "dark" ? "dark" : "light"} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-strong)]">{featuredOrganization.name}</p>
                        <p className="text-xs text-[var(--text-soft)]">
                          {featuredOrganization.role} · {featuredOrganization.period}
                        </p>
                      </div>
                    </button>
                    <span className="rounded-full border border-[color:var(--chip-border)] bg-[var(--surface-1)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                      {organizationKindLabel[featuredOrganization.kind]}
                    </span>
                  </div>
                ) : null}

                <p className="mt-4 text-base leading-8 text-[var(--text-soft)]">{activeProject.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {activeProject.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                      {tag}
                    </span>
                  ))}
                </div>

                {featuredBoardProjects.length > 1 ? (
                  <div className="mt-5 flex items-center gap-2">
                    {featuredBoardProjects.map((project, index) => (
                      <button
                        key={project.slug}
                        type="button"
                        onClick={() => setActiveBoardIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          index === activeBoardIndex ? "w-7 bg-primary" : "w-2.5 bg-[var(--outline-soft)] hover:bg-[var(--text-muted)]"
                        }`}
                        aria-label={`Show ${project.title}`}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button
                    className="rounded-[1rem] px-5 shadow-[var(--shadow-button)]"
                    onClick={() => onOpenProject(activeProject)}
                  >
                    View Full Project
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-5 text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                    onClick={onOpenResume}
                  >
                    <Download className="size-4" />
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-5 text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                    onClick={() => onNavigate("projects")}
                  >
                    All Projects
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </motion.section>
    </div>
  );
}
