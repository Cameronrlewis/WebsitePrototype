import { lazy, Suspense, useEffect, useRef, useState } from "react";

import {
  getOrganizationById,
  getProjectBySlug,
  type OrganizationRecord,
  type PageId,
  type ProjectRecord,
} from "../data/portfolio";
import { BoardViewer } from "./BoardViewer";
import { CircuitTrace } from "./CircuitTrace";
import { Contact } from "./Contact";
import { Education } from "./Education";
import { Experience } from "./Experience";
import { Home } from "./Home";
import { InteractiveBomViewer } from "./InteractiveBomViewer";
import { OrganizationContextModal } from "./OrganizationContextModal";
import { ProjectModal } from "./ProjectModal";
import { Projects } from "./Projects";
import { ReportViewer } from "./ReportViewer";
import { Sidebar } from "./Sidebar";
import { Skills } from "./Skills";
import { Updates } from "./Updates";

// Loaded on demand so pdfjs-dist stays out of the main bundle.
const ResumeViewer = lazy(() =>
  import("./ResumeViewer").then((module) => ({ default: module.ResumeViewer })),
);

const SECTION_IDS = ["home", "education", "experience", "projects", "skills", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
type ViewId = "portfolio" | "updates";

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

// Parses "#/updates", "#/education", "#/projects/aux-power-board" so every
// view, section, and project stays deep-linkable.
function parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null } {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, slug] = segments;

  if (first === "updates") {
    return { view: "updates", section: "home", project: null };
  }

  if (first === "projects" && slug) {
    const project = getProjectBySlug(slug);
    if (project) {
      return { view: "portfolio", section: "projects", project };
    }
  }

  if (first && isSectionId(first)) {
    return { view: "portfolio", section: first, project: null };
  }

  return { view: "portfolio", section: "home", project: null };
}

export function Layout() {
  const mainRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const initialRoute = parseHash(window.location.hash);
  const pendingSectionRef = useRef<SectionId | null>(
    initialRoute.view === "portfolio" && initialRoute.section !== "home" ? initialRoute.section : null,
  );

  const [view, setView] = useState<ViewId>(initialRoute.view);
  const [activeSection, setActiveSection] = useState<SectionId>(initialRoute.section);
  const [projectsViewMode, setProjectsViewMode] = useState<"all" | "featured">("featured");
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(initialRoute.project);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationRecord | null>(null);
  const [organizationReturnProject, setOrganizationReturnProject] = useState<ProjectRecord | null>(null);
  const [viewerReturnProject, setViewerReturnProject] = useState<ProjectRecord | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [reportProject, setReportProject] = useState<ProjectRecord | null>(null);
  const [boardProject, setBoardProject] = useState<ProjectRecord | null>(null);
  const [bomProject, setBomProject] = useState<ProjectRecord | null>(null);

  const scrollToSection = (sectionId: SectionId) => {
    const element = sectionRefs.current[sectionId];
    if (!element) {
      return;
    }

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    element.scrollIntoView({ behavior, block: "start" });
  };

  const handleNavigate = (target: PageId) => {
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
  };

  // Handles the deferred scroll after switching back to the portfolio view
  // (also covers the initial deep-link scroll on mount).
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
  }, [view]);

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
      const element = sectionRefs.current[sectionId];
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [view]);

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
  }, []);

  const openOrganizationById = (orgId: string) => {
    const organization = getOrganizationById(orgId);
    if (!organization) return;
    setOrganizationReturnProject(null);
    setSelectedOrganization(organization);
  };

  const openOrganization = (project: ProjectRecord, restoreProject: boolean) => {
    const organization = getOrganizationById(project.organizationId);

    if (!organization) {
      return;
    }

    if (restoreProject) {
      setOrganizationReturnProject(project);
      setSelectedProject(null);
    } else {
      setOrganizationReturnProject(null);
    }

    setSelectedOrganization(organization);
  };

  const sectionClass = "scroll-mt-32 lg:scroll-mt-2";

  const registerSection = (sectionId: SectionId) => (element: HTMLElement | null) => {
    sectionRefs.current[sectionId] = element;
  };

  const portfolioContent = (
    <div className="space-y-16 lg:space-y-24">
      <section ref={registerSection("home")} data-section="home" className={sectionClass}>
        <Home
          onNavigate={handleNavigate}
          onOpenProject={setSelectedProject}
          onOpenOrganization={(project) => openOrganization(project, false)}
          onOpenResume={() => setResumeOpen(true)}
          onOpen3D={(project) => {
            setViewerReturnProject(null);
            setSelectedProject(null);
            setBoardProject(project);
          }}
        />
      </section>

      <section ref={registerSection("education")} data-section="education" className={sectionClass}>
        <Education />
      </section>

      <section ref={registerSection("experience")} data-section="experience" className={sectionClass}>
        <Experience onOpenOrganization={openOrganizationById} />
      </section>

      <section ref={registerSection("projects")} data-section="projects" className={sectionClass}>
        <Projects
          onOpenProject={setSelectedProject}
          onOpenOrganization={(project) => openOrganization(project, false)}
          viewMode={projectsViewMode}
          onViewModeChange={setProjectsViewMode}
        />
      </section>

      <section ref={registerSection("skills")} data-section="skills" className={sectionClass}>
        <Skills />
      </section>

      <section ref={registerSection("contact")} data-section="contact" className={sectionClass}>
        <Contact onOpenResume={() => setResumeOpen(true)} />
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-7rem] size-[28rem] rounded-full bg-[var(--page-blob-1)] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] size-[26rem] rounded-full bg-[var(--page-blob-2)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 py-4 lg:flex lg:gap-6 lg:px-5">
        <Sidebar
          activeItem={view === "updates" ? "updates" : activeSection}
          onSelect={handleNavigate}
        />
        <main ref={mainRef} className="min-w-0 flex-1 pb-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">
          <div className="relative">
            <CircuitTrace scrollRef={mainRef} pageKey={view} />
            {/* lg:pl-12 reserves a gutter corridor for the circuit trace spine */}
            <div className="relative z-10 lg:pl-12">{view === "updates" ? <Updates /> : portfolioContent}</div>
          </div>
        </main>
      </div>

      <ProjectModal
        project={selectedProject}
        open={Boolean(selectedProject)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProject(null);
            setViewerReturnProject(null);
          }
        }}
        onOpenOrganization={(project) => openOrganization(project, true)}
        onOpen3D={(project) => {
          setViewerReturnProject(project);
          setSelectedProject(null);
          setBoardProject(project);
        }}
        onOpenReport={(project) => {
          setSelectedProject(null);
          setReportProject(project);
        }}
        onOpenBom={(project) => {
          setViewerReturnProject(project);
          setSelectedProject(null);
          setBomProject(project);
        }}
      />

      <OrganizationContextModal
        organization={selectedOrganization}
        open={Boolean(selectedOrganization)}
        onOpenChange={(open) => {
          if (!open) {
            const project = organizationReturnProject;
            setSelectedOrganization(null);

            if (project) {
              setSelectedProject(project);
              setOrganizationReturnProject(null);
            }
          }
        }}
        onOpenProject={(project) => {
          setSelectedOrganization(null);
          setOrganizationReturnProject(null);
          setSelectedProject(project);
        }}
      />

      {resumeOpen ? (
        <Suspense fallback={null}>
          <ResumeViewer open={resumeOpen} onOpenChange={setResumeOpen} />
        </Suspense>
      ) : null}

      <ReportViewer
        project={reportProject}
        open={Boolean(reportProject)}
        onOpenChange={(open) => {
          if (!open) {
            setReportProject(null);
          }
        }}
      />

      <BoardViewer
        project={boardProject}
        open={Boolean(boardProject)}
        onOpenChange={(open) => {
          if (!open) {
            const project = viewerReturnProject;
            setBoardProject(null);
            if (project) {
              setSelectedProject(project);
              setViewerReturnProject(null);
            }
          }
        }}
        onOpenBom={(project) => {
          setBoardProject(null);
          setBomProject(project);
        }}
      />

      <InteractiveBomViewer
        project={bomProject}
        open={Boolean(bomProject)}
        onOpenChange={(open) => {
          if (!open) {
            const project = viewerReturnProject;
            setBomProject(null);
            if (project) {
              setSelectedProject(project);
              setViewerReturnProject(null);
            }
          }
        }}
      />
    </div>
  );
}
