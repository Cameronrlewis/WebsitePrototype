import { motion } from "motion/react";
import { Download, Github, Linkedin, Mail, MapPin } from "lucide-react";

import { documents, profile, socialLinks } from "../data/portfolio";
import { SectionHeader } from "./SectionHeader";
import { MonogramText } from "./MonogramText";
import { Button } from "./ui/button";

interface ContactProps {
  onOpenResume: () => void;
}

const findLink = (label: string) => socialLinks.find((link) => link.label === label);

export function Contact({ onOpenResume }: ContactProps) {
  const emailLink = findLink("Email");
  const githubLink = findLink("GitHub");
  const linkedinLink = findLink("LinkedIn");

  const emailHref = emailLink?.href ?? `mailto:${profile.email}`;
  const emailValue = emailLink?.value ?? profile.email;

  const secondaryLinks = [
    githubLink ? { ...githubLink, Icon: Github } : null,
    linkedinLink ? { ...linkedinLink, Icon: Linkedin } : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="space-y-6">
      <SectionHeader
        index="05"
        kicker="Connect"
        title="Let's connect"
        intro="Open to internship and co-op conversations in electrical and hardware engineering."
      />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary text-[1.6rem] font-semibold text-primary-foreground shadow-[var(--shadow-button)]">
            <MonogramText value={profile.initials} />
          </div>

          <h2 className="mt-5 font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
            {profile.name}
          </h2>
          <p className="mt-1 text-base text-[var(--text-muted)]">{profile.headline}</p>

          <p className="mt-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.28em] text-[var(--text-soft)]">
            <MapPin className="size-4" />
            {profile.location}
          </p>

          <a
            href={emailHref}
            className="group mt-7 flex w-full flex-col items-center gap-2 rounded-2xl border border-[color:var(--outline-strong)] bg-[var(--surface-3)] px-6 py-6 shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-4)] sm:flex-row sm:justify-center sm:gap-4"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
              <Mail className="size-4" />
            </span>
            <span className="flex flex-col items-center sm:items-start">
              <span className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">Email me</span>
              <span className="mt-1 font-display text-lg font-semibold tracking-[-0.01em] text-[var(--text-strong)] break-all">
                {emailValue}
              </span>
            </span>
          </a>

          <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
            {secondaryLinks.map(({ label, value, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-3)] px-4 py-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-4)]"
              >
                <Icon className="size-4" />
                <span className="truncate">{value}</span>
              </a>
            ))}
          </div>

          <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
            <Button className="rounded-xl shadow-[var(--shadow-button)]" onClick={onOpenResume}>
              <Download className="size-4" />
              Open Resume
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
            >
              <a href={documents.resume} download>
                <Download className="size-4" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
