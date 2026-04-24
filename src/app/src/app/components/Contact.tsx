import { useState } from "react";
import { motion } from "motion/react";
import { Download, Github, Linkedin, Mail, MapPin, Send } from "lucide-react";

import { documents, profile, socialLinks } from "../data/portfolio";
import { MonogramText } from "./MonogramText";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface ContactProps {
  onOpenResume: () => void;
}

export function Contact({ onOpenResume }: ContactProps) {
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3rem]">Contact &amp; Profile</h1>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05 }}
          className="rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-6 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex size-24 items-center justify-center rounded-full bg-primary text-[2rem] font-semibold text-primary-foreground shadow-[var(--shadow-button)]">
              <MonogramText value={profile.initials} />
            </div>
            <h2 className="mt-5 text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{profile.name}</h2>
            <p className="mt-1 text-base text-[var(--text-muted)]">{profile.headline} - Class of 2029</p>
          </div>

          <div className="mt-6 space-y-3">
            <a href={socialLinks[0].href} className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-3)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-4)]">
                <Mail className="size-4" />
              </span>
              <span>{socialLinks[0].value}</span>
            </a>

            <div className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-body)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-4)]">
                <MapPin className="size-4" />
              </span>
              <span>{profile.location}</span>
            </div>

            <a
              href={socialLinks[1].href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-4)]">
                <Github className="size-4" />
              </span>
              <span>{socialLinks[1].value}</span>
            </a>

            <a
              href={socialLinks[2].href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-4)]">
                <Linkedin className="size-4" />
              </span>
              <span>{socialLinks[2].value}</span>
            </a>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button className="rounded-[1rem] shadow-[var(--shadow-button)]" onClick={onOpenResume}>
              <Download className="size-4" />
              Open Resume
            </Button>
            <Button asChild variant="outline" className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]">
              <a href={documents.resume} download>
                <Download className="size-4" />
                Download
              </a>
            </Button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.1 }}
          className="rounded-[1.8rem] border border-[color:var(--outline-strong)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)]"
        >
          <h2 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">Send a message</h2>

          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-body)]">Your name</span>
                <Input
                  required
                  placeholder="Cameron Lewis"
                  className="h-11 rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--input-background)] px-4 text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-body)]">Email</span>
                <Input
                  required
                  type="email"
                  placeholder="name@example.com"
                  className="h-11 rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--input-background)] px-4 text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-body)]">Subject</span>
              <Input
                required
                placeholder="Internship, project, or collaboration"
                className="h-11 rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--input-background)] px-4 text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-body)]">Message</span>
              <Textarea
                required
                rows={8}
                placeholder="Briefly describe the role, team, timeline, or what you need help with."
                className="min-h-[10.5rem] rounded-[1.2rem] border-[color:var(--outline-soft)] bg-[var(--input-background)] px-4 py-3 text-[var(--text-strong)] placeholder:text-[var(--text-muted)]"
              />
            </label>

            <p className="pt-2 text-sm text-[var(--text-muted)]">
              {sent ? "Prototype form submitted locally. Hook a delivery target in later if you want real sending." : "This prototype keeps the form flow local for now."}
            </p>

            <div className="flex justify-start pt-1 sm:justify-end">
              <Button className="w-full rounded-[1rem] px-5 shadow-[var(--shadow-button)] sm:w-auto sm:min-w-[17rem]" type="submit">
                <Send className="size-4" />
                Send Message
              </Button>
            </div>
          </form>
        </motion.section>
      </div>
    </div>
  );
}
