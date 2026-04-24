"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "./ThemeProvider";
import { cn } from "./ui/utils";

interface ThemeToggleProps {
  variant?: "compact" | "segmented";
  className?: string;
}

export function ThemeToggle({
  variant = "segmented",
  className,
}: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border border-[color:var(--toggle-border)] bg-[var(--toggle-shell-bg)] text-[var(--toggle-shell-text)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--toggle-hover-bg)]",
          className,
        )}
      >
        {isDark ? <SunMedium className="size-[18px]" /> : <MoonStar className="size-[18px]" />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-[color:var(--toggle-border)] bg-[var(--toggle-shell-bg)] p-1 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
          theme === "light"
            ? "bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)]"
            : "text-[var(--toggle-shell-text)] hover:bg-[var(--toggle-hover-bg)]",
        )}
      >
        <SunMedium className="size-4" />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
          theme === "dark"
            ? "bg-[var(--toggle-active-bg)] text-[var(--toggle-active-text)]"
            : "text-[var(--toggle-shell-text)] hover:bg-[var(--toggle-hover-bg)]",
        )}
      >
        <MoonStar className="size-4" />
        Dark
      </button>
    </div>
  );
}
