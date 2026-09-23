// @vitest-environment jsdom
// copyText's execCommand fallback touches document.createElement/body, which
// only exist under a DOM environment — the rest of the suite stays on the
// faster "node" environment set globally in vitest.config.ts.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { copyText } from "../src/app/src/app/components/Contact";

describe("copyText", () => {
  const originalClipboard = navigator.clipboard;

  // jsdom has no execCommand; give vi.spyOn a real method to wrap and restore.
  beforeAll(() => {
    document.execCommand ??= () => false;
  });

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
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);

    const result = await copyText("hello@example.com");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
  });

  it("falls back to document.execCommand when writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);

    const result = await copyText("hello@example.com");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
  });

  it("reports failure when execCommand returns false", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    vi.spyOn(document, "execCommand").mockReturnValue(false);

    expect(await copyText("hello@example.com")).toBe(false);
  });
});
