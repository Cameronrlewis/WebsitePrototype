import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Briefcase,
  Download,
  FolderKanban,
  GraduationCap,
  Mail,
  MapPin,
  Orbit,
  Sparkles,
} from "lucide-react";

import {
  featuredProject,
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

export function Home({ onNavigate, onOpenProject, onOpenOrganization, onOpenResume, onOpen3D }: HomeProps) {
  const { theme } = useTheme();
  const [typedText, setTypedText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const featuredOrganization = getOrganizationById(featuredProject.organizationId);

  const currentPhrase = useMemo(
    () => profile.typedPhrases[phraseIndex % profile.typedPhrases.length],
    [phraseIndex],
  );

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
        className="rounded-[2rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
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
              <a href={socialLinks[1].href} target="_blank" rel="noreferrer" className="transition-colors hover:text-[var(--text-strong)]">
                {socialLinks[1].value}
              </a>
              <a href={socialLinks[2].href} target="_blank" rel="noreferrer" className="transition-colors hover:text-[var(--text-strong)]">
                {socialLinks[2].value}
              </a>
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
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground shadow-[var(--shadow-button)]">
            <Sparkles className="size-3.5" />
            Featured Project
          </span>
          <span className="text-[var(--text-muted)]">{featuredProject.category}</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <button
            type="button"
            onClick={() => onOpen3D(featuredProject)}
            className="group block w-full overflow-hidden rounded-[1.75rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-left shadow-[var(--shadow-strong)]"
          >
            <div className="relative min-h-[18rem] overflow-hidden lg:min-h-[22rem]">
              {(featuredProject.cardImg ?? featuredProject.bannerImg) ? (
                <div
                  className="h-full w-full"
                  style={{ background: featuredProject.cardBackground ?? "#0c0c14" }}
                >
                  <img
                    src={featuredProject.cardImg ?? featuredProject.bannerImg}
                    alt={`${featuredProject.title} preview`}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]"
                    style={{
                      objectFit: featuredProject.cardContain ? "contain" : "cover",
                      objectPosition: featuredProject.cardImgPosition ?? "center",
                      transform: featuredProject.cardScale ? `scale(${featuredProject.cardScale})` : undefined,
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
              {featuredProject.title}
            </h2>

            {featuredOrganization ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenOrganization(featuredProject)}
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

            <p className="mt-4 text-base leading-8 text-[var(--text-soft)]">{featuredProject.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {featuredProject.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[color:var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)]">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                className="rounded-[1rem] px-5 shadow-[var(--shadow-button)]"
                onClick={() => onOpenProject(featuredProject)}
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
      </motion.section>
    </div>
  );
}
