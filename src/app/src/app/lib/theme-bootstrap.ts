export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "portfolio-theme";

export function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  // localStorage/matchMedia can throw under some browser storage policies or
  // embedded webviews; this runs before React renders, so an uncaught throw
  // here would leave the page blank. Fall through to the next step instead.
  let savedTheme: string | null = null;
  try {
    savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    savedTheme = null;
  }
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
