import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { PageId, ProjectRecord } from "../data/portfolio";
import { isSectionId, parseHash, SECTION_IDS, type SectionId, type ViewId } from "../lib/routing";

interface UseHashRouteOptions {
  mainRef: RefObject<HTMLElement | null>;
  sectionRefs: RefObject<Partial<Record<SectionId, HTMLElement | null>>>;
}

export function useHashRoute({ mainRef, sectionRefs }: UseHashRouteOptions) {
  const initialRoute = parseHash(window.location.hash);
  const pendingSectionRef = useRef<SectionId | null>(
    initialRoute.view === "portfolio" && initialRoute.section !== "home" ? initialRoute.section : null,
  );

  const [view, setView] = useState<ViewId>(initialRoute.view);
  const [activeSection, setActiveSection] = useState<SectionId>(initialRoute.section);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(initialRoute.project);

  const scrollToSection = useCallback(
    (sectionId: SectionId) => {
      const element = sectionRefs.current?.[sectionId];
      if (!element) {
        return;
      }

      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      element.scrollIntoView({ behavior, block: "start" });
    },
    [sectionRefs],
  );

  const navigate = useCallback(
    (target: PageId) => {
      if (target === "updates") {
        setView("updates");
        return;
      }

      if (view !== "portfolio") {
        pendingSectionRef.current = target;
        setView("portfolio");
        return;
      }

      setActiveSection(target);
      scrollToSection(target);
    },
    [scrollToSection, view],
  );

  // Deferred scroll after switching back to the portfolio view; also covers the
  // initial deep-link scroll on mount. Two nested rAFs because the target
  // section is not laid out yet on the frame the view switches.
  useEffect(() => {
    if (view === "portfolio" && pendingSectionRef.current) {
      const sectionId = pendingSectionRef.current;
      pendingSectionRef.current = null;
      setActiveSection(sectionId);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSection(sectionId));
      });
    }

    if (view === "updates") {
      mainRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [mainRef, scrollToSection, view]);

  // Scroll spy: highlight the section currently in the middle of the screen.
  useEffect(() => {
    if (view !== "portfolio") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute("data-section");
            if (sectionId && isSectionId(sectionId)) {
              setActiveSection(sectionId);
            }
          }
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
    );

    for (const sectionId of SECTION_IDS) {
      const element = sectionRefs.current?.[sectionId];
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [sectionRefs, view]);

  useEffect(() => {
    const nextHash = selectedProject
      ? `#/projects/${selectedProject.slug}`
      : view === "updates"
        ? "#/updates"
        : `#/${activeSection}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [view, activeSection, selectedProject]);

  useEffect(() => {
    const onHashChange = () => {
      const route = parseHash(window.location.hash);
      setView(route.view);
      setSelectedProject(route.project);

      if (route.view === "portfolio") {
        pendingSectionRef.current = route.section;
        requestAnimationFrame(() => {
          if (pendingSectionRef.current) {
            const sectionId = pendingSectionRef.current;
            pendingSectionRef.current = null;
            setActiveSection(sectionId);
            scrollToSection(sectionId);
          }
        });
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [scrollToSection]);

  return { view, activeSection, selectedProject, setView, setActiveSection, setSelectedProject, navigate };
}
