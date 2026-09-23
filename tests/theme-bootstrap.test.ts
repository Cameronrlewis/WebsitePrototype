// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveInitialTheme, THEME_STORAGE_KEY } from "../src/app/src/app/lib/theme-bootstrap";

describe("resolveInitialTheme", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  function mockPrefersDark(matches: boolean) {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
  }

  it("returns the saved theme when it is 'dark'", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockPrefersDark(false);

    expect(resolveInitialTheme()).toBe("dark");
  });

  it("returns the saved theme when it is 'light'", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockPrefersDark(true);

    expect(resolveInitialTheme()).toBe("light");
  });

  it("falls back to prefers-color-scheme when the saved value is garbage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "not-a-theme");
    mockPrefersDark(true);

    expect(resolveInitialTheme()).toBe("dark");
  });

  it("prefers dark when nothing is saved and the system prefers dark", () => {
    mockPrefersDark(true);

    expect(resolveInitialTheme()).toBe("dark");
  });

  it("prefers light when nothing is saved and the system does not prefer dark", () => {
    mockPrefersDark(false);

    expect(resolveInitialTheme()).toBe("light");
  });

  it("falls back to prefers-color-scheme when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    mockPrefersDark(true);

    expect(resolveInitialTheme()).toBe("dark");
  });

  it("falls back to light when matchMedia throws", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(() => {
      throw new Error("matchMedia unavailable");
    });

    expect(resolveInitialTheme()).toBe("light");
  });
});
