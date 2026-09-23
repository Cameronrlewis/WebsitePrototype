// @vitest-environment jsdom
//
// Same hand-rolled harness as use-modal-stack.test.ts: a host component calls
// the hook and hands its return value out through a ref, and act() flushes
// each state change. requestAnimationFrame is replaced with a manual queue so
// the double-rAF scroll can be driven deterministically.

import { createElement, type MutableRefObject, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProjectBySlug } from "../src/app/src/app/data/portfolio";
import { useHashRoute } from "../src/app/src/app/hooks/useHashRoute";
import { SECTION_IDS, type SectionId } from "../src/app/src/app/lib/routing";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useHashRoute>;

const sections = Object.fromEntries(SECTION_IDS.map((id) => [id, document.createElement("section")])) as Record<
  SectionId,
  HTMLElement
>;

function Harness({ apiRef }: { apiRef: MutableRefObject<Api | null> }) {
  const mainRef = useRef<HTMLElement | null>(document.createElement("main"));
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>(sections);
  apiRef.current = useHashRoute({ mainRef, sectionRefs });
  return null;
}

describe("useHashRoute", () => {
  let container: HTMLDivElement;
  let root: Root;
  let apiRef: MutableRefObject<Api | null>;
  let frames: FrameRequestCallback[];

  function render() {
    act(() => {
      root = createRoot(container);
      root.render(createElement(Harness, { apiRef }));
    });
  }

  function api(): Api {
    if (!apiRef.current) throw new Error("harness did not render");
    return apiRef.current;
  }

  function goTo(hash: string) {
    act(() => {
      window.history.replaceState(null, "", hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  // Runs queued frames until none are left, so nested rAFs fire too.
  function flushFrames() {
    act(() => {
      while (frames.length) frames.shift()!(0);
    });
  }

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    window.scrollTo = vi.fn();
    for (const element of Object.values(sections)) element.scrollIntoView = vi.fn();

    container = document.createElement("div");
    document.body.appendChild(container);
    apiRef = { current: null } as MutableRefObject<Api | null>;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps an open project modal when the skip link sets #main-content", () => {
    window.history.replaceState(null, "", "#/projects/thermal-camera");
    render();
    expect(api().selectedProject?.slug).toBe("thermal-camera");

    goTo("#main-content");

    expect(api().selectedProject?.slug).toBe("thermal-camera");
  });

  it("scrolls only to the last of two back-to-back section navigations", () => {
    render();

    goTo("#/education");
    goTo("#/skills");
    flushFrames();

    expect(sections.skills.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(sections.education.scrollIntoView).not.toHaveBeenCalled();
    expect(api().activeSection).toBe("skills");
  });

  it("writes the open project back to the hash without re-routing", () => {
    render();
    const project = getProjectBySlug("thermal-camera")!;

    act(() => {
      api().setSelectedProject(project);
    });
    expect(window.location.hash).toBe("#/projects/thermal-camera");
    expect(api().selectedProject).toBe(project);

    act(() => {
      api().setSelectedProject(null);
    });
    expect(window.location.hash).toBe("#/home");
    expect(api().selectedProject).toBeNull();
  });
});
