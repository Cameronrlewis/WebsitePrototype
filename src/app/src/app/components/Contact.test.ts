// @vitest-environment jsdom
// copyText's execCommand fallback touches document.createElement/body, which
// only exist under a DOM environment — the rest of the suite stays on the
// faster "node" environment set globally in vitest.config.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./Contact";

describe("copyText", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
    vi.restoreAllMocks();
  });

  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const result = await copyText("hello@example.com");

    expect(writeText).toHaveBeenCalledWith("hello@example.com");
    expect(result).toBe(true);
  });

  it("falls back to document.execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const result = await copyText("hello@example.com");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
  });
});
