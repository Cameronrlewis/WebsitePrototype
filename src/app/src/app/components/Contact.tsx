import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Download, ExternalLink, Github, Linkedin, Mail, MapPin } from "lucide-react";

import { documents, profile, socialLinks } from "../data/portfolio";
import { SectionHeader } from "./SectionHeader";

interface ContactProps {
  onOpenResume: () => void;
}

const findLink = (label: string) => socialLinks.find((link) => link.label === label);

/**
 * Pinout geometry. The rows on the right are a fixed `ROW_H` tall, and the SVG
 * on the left is rendered 1:1 (viewBox height === CSS height, `slice` so a
 * narrow column clips the right of the drawing instead of scaling it down), so
 * pin `y` in user units is the same pixel as the matching row centre.
 */
const ROW_H = 64;
const PIN_COUNT = 5;
const SVG_H = ROW_H * PIN_COUNT;
const SVG_W = 560;
const BODY = { x: 26, y: 18, w: 208, h: SVG_H - 36, rx: 18 };
const STUB_START = BODY.x + BODY.w;
const STUB_END = STUB_START + 34;
const pinY = (index: number) => index * ROW_H + ROW_H / 2;

type PinId = "tx-email" | "rx-linkedin" | "io-github" | "doc-resume" | "gnd";

interface PinRow {
  id: PinId;
  pin: string;
  content: ReactNode;
}

export async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function Contact({ onOpenResume }: ContactProps) {
  const [hoveredPin, setHoveredPin] = useState<PinId | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const emailLink = findLink("Email");
  const githubLink = findLink("GitHub");
  const linkedinLink = findLink("LinkedIn");

  const emailValue = emailLink?.value ?? profile.email;
  const emailHref = emailLink?.href ?? `mailto:${profile.email}`;

  const handleCopyEmail = async () => {
    const ok = await copyText(profile.email);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const rows: PinRow[] = [
    {
      id: "tx-email",
      pin: "TX_EMAIL",
      content: (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={handleCopyEmail}
            className="group/copy flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-3)]"
            aria-label={`Copy ${profile.email} to clipboard`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
              <Mail className="size-4" />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="ack"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 truncate font-mono text-sm uppercase tracking-[0.16em] text-[color:var(--primary)]"
                  >
                    <Check className="size-4 shrink-0" />
                    ACK — copied to clipboard
                  </motion.span>
                ) : (
                  <motion.span
                    key="value"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 truncate font-display text-[0.95rem] font-semibold tracking-[-0.01em] xl:text-base"
                  >
                    {emailValue}
                    <Copy className="hidden size-3.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover/copy:opacity-100 xl:block" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
          <a
            href={emailHref}
            aria-label="Compose an email"
            title="Compose an email"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--outline-soft)] bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-4)] hover:text-[var(--text-strong)]"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ),
    },
    {
      id: "rx-linkedin",
      pin: "RX_LINKEDIN",
      content: (
        <a
          href={linkedinLink?.href ?? "https://www.linkedin.com/in/cameron-lewis-/"}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-3)]"
        >
          <Linkedin className="size-4 shrink-0 text-[var(--text-muted)]" />
          <span className="min-w-0 flex-1 truncate">{linkedinLink?.value ?? "LinkedIn"}</span>
          <ExternalLink className="size-3.5 shrink-0 text-[var(--text-muted)]" />
        </a>
      ),
    },
    {
      id: "io-github",
      pin: "IO_GITHUB",
      content: (
        <a
          href={githubLink?.href ?? "https://github.com/Cameronrlewis"}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-3)]"
        >
          <Github className="size-4 shrink-0 text-[var(--text-muted)]" />
          <span className="min-w-0 flex-1 truncate">{githubLink?.value ?? "GitHub"}</span>
          <ExternalLink className="size-3.5 shrink-0 text-[var(--text-muted)]" />
        </a>
      ),
    },
    {
      id: "doc-resume",
      pin: "DOC_RESUME",
      content: (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onOpenResume}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-3)]"
          >
            <Download className="size-4 shrink-0 text-[var(--text-muted)]" />
            <span className="min-w-0 flex-1 truncate">Open resume</span>
          </button>
          <a
            href={documents.resume}
            download
            aria-label="Download resume"
            title="Download resume"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-2.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-4)] hover:text-[var(--text-strong)]"
          >
            <Download className="size-3.5" />
            PDF
          </a>
        </div>
      ),
    },
    {
      id: "gnd",
      pin: "GND",
      content: (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 text-[var(--text-muted)]">
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
              <path d="M8 2.5v5" />
              <path d="M3.5 7.75h9" />
              <path d="M5.25 10.4h6.5" />
              <path d="M7 13h2" />
            </g>
          </svg>
          <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">
            no connection required — just say hi
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        index="05"
        kicker="Connect"
        title="Establish link"
        intro="Reach out about hardware, student teams, or anything you see on this site."
      />

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        className="rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.5fr] xl:grid-cols-[1fr_1.2fr]">
          {/* IC package — 1:1 pixel mapping, clipped (not scaled) in narrow columns */}
          <div className="hidden self-start overflow-hidden lg:block lg:-mr-10">
            <motion.svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width="100%"
              height={SVG_H}
              preserveAspectRatio="xMinYMid slice"
              role="img"
              aria-label="Contact interface IC pinout diagram"
              style={{ pointerEvents: "none" }}
              variants={{
                hidden: {},
                visible: { transition: { delayChildren: 0.12, staggerChildren: 0.08 } },
              }}
            >
              <motion.g
                variants={{
                  hidden: { opacity: 0, scale: 0.94 },
                  visible: { opacity: 1, scale: 1, transition: { duration: 0.45 } },
                }}
                style={{ transformOrigin: "120px 160px" }}
              >
                <rect
                  x={BODY.x}
                  y={BODY.y}
                  width={BODY.w}
                  height={BODY.h}
                  rx={BODY.rx}
                  fill="var(--surface-2)"
                  stroke="var(--outline-soft)"
                  strokeWidth="1"
                />
                {/* package notch */}
                <path
                  d={`M ${BODY.x + BODY.w / 2 - 16} ${BODY.y} a 16 16 0 0 0 32 0`}
                  fill="var(--surface-1)"
                  stroke="var(--outline-soft)"
                  strokeWidth="1"
                />
                {/* pin-1 dot */}
                <circle cx={BODY.x + 24} cy={BODY.y + 26} r="5" fill="var(--primary)" />
                <text
                  x={BODY.x + BODY.w / 2}
                  y={BODY.y + 98}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="30"
                  letterSpacing="2"
                  fill="var(--text-strong)"
                >
                  CL-2026
                </text>
                <text
                  x={BODY.x + BODY.w / 2}
                  y={BODY.y + 130}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="13"
                  letterSpacing="3.5"
                  fill="var(--text-soft)"
                >
                  COMM INTERFACE
                </text>
                <text
                  x={BODY.x + BODY.w / 2}
                  y={BODY.y + 166}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="11"
                  letterSpacing="2.5"
                  fill="var(--text-muted)"
                >
                  YYWW 2631
                </text>
                <text
                  x={BODY.x + BODY.w / 2}
                  y={BODY.y + 212}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="10"
                  letterSpacing="2"
                  fill="var(--text-muted)"
                >
                  ST JOHN&apos;S NL
                </text>
              </motion.g>

              {rows.map((row, index) => {
                const y = pinY(index);
                const active = hoveredPin === row.id;
                return (
                  <motion.g
                    key={row.id}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { duration: 0.3 } },
                    }}
                    style={{ pointerEvents: "auto" }}
                    onMouseEnter={() => setHoveredPin(row.id)}
                    onMouseLeave={() => setHoveredPin((current) => (current === row.id ? null : current))}
                  >
                    {/* invisible hit area */}
                    <line
                      x1={STUB_START}
                      y1={y}
                      x2={SVG_W}
                      y2={y}
                      stroke="transparent"
                      strokeWidth="16"
                    />
                    <rect
                      x={STUB_START - 4}
                      y={y - 5}
                      width={12}
                      height={10}
                      rx={2}
                      fill="var(--surface-3)"
                      stroke="var(--outline-strong)"
                      strokeWidth="1"
                    />
                    {/* plain <g> carries the glow: motion.path caches `filter` and
                        would not re-apply it on hover re-renders */}
                    <g
                      style={{
                        filter: active ? "drop-shadow(0 0 6px var(--primary))" : "none",
                        transition: "filter 0.25s ease",
                      }}
                    >
                      <motion.path
                        d={`M ${STUB_START + 6} ${y} H ${STUB_END}`}
                        stroke="var(--primary)"
                        strokeWidth="5"
                        strokeLinecap="round"
                        fill="none"
                        strokeOpacity={active ? 1 : 0.55}
                        variants={{
                          hidden: { pathLength: 0 },
                          visible: { pathLength: 1, transition: { duration: 0.35 } },
                        }}
                      />
                      <motion.path
                        d={`M ${STUB_END} ${y} H ${SVG_W}`}
                        stroke="var(--primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        strokeOpacity={active ? 1 : 0.3}
                        variants={{
                          hidden: { pathLength: 0 },
                          visible: { pathLength: 1, transition: { duration: 0.5 } },
                        }}
                      />
                    </g>
                  </motion.g>
                );
              })}
            </motion.svg>
          </div>

          {/* Pin rows — one per pin, same fixed height as the SVG pin pitch */}
          <div className="flex min-w-0 flex-col">
            {rows.map((row) => {
              const active = hoveredPin === row.id;
              return (
                <motion.div
                  key={row.id}
                  variants={{
                    hidden: { opacity: 0, x: 10 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
                  }}
                  onMouseEnter={() => setHoveredPin(row.id)}
                  onMouseLeave={() => setHoveredPin((current) => (current === row.id ? null : current))}
                  style={{ height: ROW_H }}
                  className={`flex min-w-0 items-center gap-3 border-b border-[color:var(--outline-soft)] last:border-b-0 transition-colors ${
                    active ? "text-[var(--text-strong)]" : "text-[var(--text-body)]"
                  }`}
                >
                  <span className="flex shrink-0 items-center" aria-hidden="true">
                    <span
                      className="block h-px w-3 transition-opacity"
                      style={{ background: "var(--primary)", opacity: active ? 1 : 0.3 }}
                    />
                    <span
                      className="block size-2 rounded-[2px] border transition-colors"
                      style={{
                        background: active ? "var(--primary)" : "var(--surface-3)",
                        borderColor: active ? "var(--primary)" : "var(--outline-strong)",
                      }}
                    />
                  </span>
                  <span
                    className={`hidden w-24 shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition-colors sm:block xl:w-28 xl:text-[0.65rem] xl:tracking-[0.18em] ${
                      active ? "text-[color:var(--primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {row.pin}
                  </span>
                  {row.content}
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
          }}
          className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[color:var(--outline-soft)] pt-4 font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-soft)]"
        >
          <MapPin className="size-4" />
          {profile.location}
          <span className="text-[var(--text-muted)]">·</span>
          {profile.availability}
        </motion.p>
      </motion.section>
    </div>
  );
}
