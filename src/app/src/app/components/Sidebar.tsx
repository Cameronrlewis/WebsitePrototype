import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Briefcase,
  FolderKanban,
  GraduationCap,
  Home as HomeIcon,
  Mail,
  ScrollText,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { profile } from "../data/portfolio";
import type { PageId } from "../data/portfolio";
import { MonogramText } from "./MonogramText";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "./ui/utils";

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const navigationItems: Array<{ id: PageId; label: string; description: string; icon: typeof HomeIcon }> = [
  { id: "home", label: "Home", description: "About me", icon: HomeIcon },
  { id: "experience", label: "Experience", description: "Work & internships", icon: Briefcase },
  { id: "projects", label: "Projects", description: "Featured builds", icon: FolderKanban },
  { id: "updates", label: "Updates", description: "Project activity log", icon: ScrollText },
  { id: "skills", label: "Skills", description: "Tools & workflow", icon: Sparkles },
  { id: "education", label: "Education", description: "Coursework", icon: GraduationCap },
  { id: "contact", label: "Contact", description: "Get in touch", icon: Mail },
];

const collapsedWidth = 88;
const expandedWidth = 280;

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<PageId | null>(null);

  const currentItem = useMemo(
    () => navigationItems.find((item) => item.id === currentPage) ?? navigationItems[0],
    [currentPage],
  );
  const collapsedItems = useMemo(
    () => (currentPage === "education" ? navigationItems : navigationItems.filter((item) => item.id !== "education")),
    [currentPage],
  );

  return (
    <>
      <div className="sticky top-0 z-30 mb-4 lg:hidden">
        <div className="rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--sidebar-shell)] p-4 shadow-[var(--shadow-card)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-[var(--text-strong)]">{profile.name}</div>
              <div className="text-sm text-[var(--text-muted)]">{profile.headline}</div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle variant="compact" />
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-button)]">
                <MonogramText value={profile.initials} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === currentPage;

              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-button)]"
                      : "border-[color:var(--outline-soft)] bg-[var(--surface-3)] text-[var(--text-body)] hover:bg-[var(--surface-1)]",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <motion.aside
        className="hidden lg:block lg:shrink-0"
        animate={{ width: isOpen ? expandedWidth : collapsedWidth }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <motion.div
          className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-[color:var(--outline-soft)] bg-[var(--sidebar-shell)] shadow-[var(--shadow-card)]"
          animate={{ paddingLeft: isOpen ? 20 : 12, paddingRight: isOpen ? 20 : 12, paddingTop: 16, paddingBottom: 16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <motion.div
            layout
            className={cn("flex items-start", isOpen ? "justify-between" : "justify-center")}
          >
            <motion.div
              layout
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-button)]"
            >
              <Zap className="size-5" />
            </motion.div>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.button
                  key="sidebar-close"
                  type="button"
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, scale: 0.92, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.92, x: 10 }}
                  transition={{ duration: 0.16 }}
                  className="flex size-9 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
                  aria-label="Close sidebar"
                >
                  <X className="size-4" />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence initial={false}>
            {isOpen ? (
              <motion.div
                key="sidebar-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className="mt-5 text-center"
              >
                <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{profile.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Electrical Portfolio</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className={cn("flex justify-center", isOpen ? "mt-5" : "mt-5")}>
            <ThemeToggle variant={isOpen ? "segmented" : "compact"} className={isOpen ? "w-full justify-center" : ""} />
          </div>

          <nav className={cn("relative", isOpen ? "mt-6 space-y-3" : "mt-6 flex flex-1 flex-col items-center gap-4")}>
            {(isOpen ? navigationItems : collapsedItems).map((item) => {
              const Icon = item.icon;
              const active = item.id === currentPage;
              const hovered = hoveredItem === item.id;
              const showTriangle = !isOpen && hoveredItem === item.id;
              const openInverted = active || hovered;
              const closedInverted = active || hovered;
              const darkState = isOpen ? openInverted : closedInverted;

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem((current) => (current === item.id ? null : current))}
                >
                  <button
                    onClick={() => {
                      onPageChange(item.id);
                      setIsOpen(true);
                    }}
                    aria-label={item.label}
                    className={cn(
                      "relative isolate overflow-hidden transition-all duration-200",
                      isOpen
                        ? cn(
                            "flex w-full items-center gap-4 rounded-[1.15rem] border px-4 py-3 text-left",
                            openInverted
                              ? "border-[color:var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-[var(--shadow-button)]"
                              : "border-[color:var(--sidebar-item-border)] bg-[var(--sidebar-item-bg)] text-[var(--sidebar-item-text)]",
                          )
                        : cn(
                            "flex size-12 items-center justify-center rounded-full border",
                            closedInverted
                              ? cn(
                                  "text-[var(--sidebar-active-text)] shadow-[var(--shadow-soft)]",
                                  active
                                    ? "border-[color:var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)]"
                                    : "border-[color:var(--sidebar-collapsed-hover-border)] bg-[var(--sidebar-collapsed-hover)]",
                                )
                              : "border-[color:var(--sidebar-item-border)] bg-[var(--sidebar-item-bg)] text-[var(--sidebar-item-text)]",
                            ),
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {darkState ? (
                        <motion.span
                          key={`${item.id}-glow`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: hovered ? 1 : 0.72, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.18 }}
                          className="pointer-events-none absolute inset-0 [border-radius:inherit] bg-[radial-gradient(circle_at_88%_88%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.14)_18%,rgba(255,255,255,0.05)_34%,transparent_62%),linear-gradient(135deg,transparent_58%,rgba(255,255,255,0.05)_78%,transparent_100%)]"
                        />
                      ) : null}
                    </AnimatePresence>

                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center transition-all duration-200",
                        isOpen
                          ? cn(
                              "size-10 rounded-2xl",
                              openInverted
                                ? "bg-[var(--sidebar-active-icon-bg)] text-current"
                                : "bg-[var(--sidebar-icon-bg)] text-[var(--sidebar-icon-text)] shadow-[var(--shadow-soft)]",
                            )
                          : "size-5",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          key={`${item.id}-label`}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.16 }}
                          className="relative z-10 min-w-0 flex-1"
                        >
                          <div className="font-medium">{item.label}</div>
                          <div className={cn("text-sm", openInverted ? "text-[var(--sidebar-active-muted)]" : "text-[var(--sidebar-item-muted)]")}>{item.description}</div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {isOpen && active ? <span className="relative z-10 size-2 rounded-full bg-[var(--sidebar-active-muted)]" /> : null}
                  </button>

                  <AnimatePresence>
                    {showTriangle ? (
                      <motion.span
                        key={`${item.id}-triangle`}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.14 }}
                        className="pointer-events-none absolute right-[-8px] top-1/2 block h-[14px] w-[8px] -translate-y-1/2 bg-[var(--sidebar-triangle)] [clip-path:polygon(0_50%,100%_0,100%_100%)]"
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <motion.div
            layout
            className={cn("mt-auto", isOpen ? "pt-6 text-center" : "flex justify-center pt-6")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div
                  key="sidebar-footer-open"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="text-lg font-semibold text-[var(--text-strong)]">{profile.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{currentItem.description}</div>
                  <div className="mx-auto mt-4 flex size-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-button)]">
                    <MonogramText value={profile.initials} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="sidebar-footer-closed"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.16 }}
                  className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-button)]"
                >
                  <MonogramText value={profile.initials} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.aside>
    </>
  );
}
