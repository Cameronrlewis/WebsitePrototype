import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { PageId, ProjectRecord } from "../data/portfolio";
import { isAppRoute, isSectionId, parseHash, SECTION_IDS, type SectionId, type ViewId } from "../lib/routing";

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

  // Shared by both the view-switch effect and the hashchange listener: after
  // the portfolio view (re)mounts, the target section isn't laid out yet on
  // the frame the view switches, so wait two animation frames before
  // scrolling. Re-checks pendingSectionRef before scrolling so a second,
  // faster navigation that overwrites the pending target wins.
  const scrollToPendingSection = useCallback(
    (sectionId: SectionId) => {
      pendingSectionRef.current = sectionId;
      setActiveSection(sectionId);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (pendingSectionRef.current === sectionId) {
            pendingSectionRef.current = null;
            scrollToSection(sectionId);
          }
        });
      });
    },
    [scrollToSection],
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
  // initial deep-link scroll on mount.
  useEffect(() => {
    if (view === "portfolio" && pendingSectionRef.current) {
      scrollToPendingSection(pendingSectionRef.current);
    }

    if (view === "updates") {
      mainRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [mainRef, scrollToPendingSection, view]);

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
      // A non-route hash (e.g. the skip link's "#main-content") isn't a
      // navigation - ignore it instead of falling through parseHash's home
      // fallback, which would scroll to home and close any open project modal.
      if (!isAppRoute(window.location.hash)) {
        return;
      }

      const route = parseHash(window.location.hash);
      setView(route.view);
      setSelectedProject(route.project);

      if (route.view === "portfolio") {
        scrollToPendingSection(route.section);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [scrollToPendingSection]);

  return { view, activeSection, selectedProject, setView, setActiveSection, setSelectedProject, navigate };
}
