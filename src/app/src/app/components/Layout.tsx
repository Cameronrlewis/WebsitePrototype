import { lazy, Suspense, useRef, useState } from "react";

import { getOrganizationById, type OrganizationRecord, type ProjectRecord } from "../data/portfolio";
import type { SectionId } from "../lib/routing";
import { useHashRoute } from "../hooks/useHashRoute";
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
import { FORCE_SKELETONS, ResumeViewerSkeleton, SkeletonPreviewBadge } from "./Skeletons";
import { Skills } from "./Skills";
import { Updates } from "./Updates";

// Loaded on demand so pdfjs-dist stays out of the main bundle.
const ResumeViewer = lazy(() =>
  import("./ResumeViewer").then((module) => ({ default: module.ResumeViewer })),
);

export type { SectionId } from "../lib/routing";

export function Layout() {
  const mainRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const { view, activeSection, selectedProject, setSelectedProject, navigate } = useHashRoute({
    mainRef,
    sectionRefs,
  });

  const [projectsViewMode, setProjectsViewMode] = useState<"all" | "featured">("featured");
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationRecord | null>(null);
  const [organizationReturnProject, setOrganizationReturnProject] = useState<ProjectRecord | null>(null);
  const [viewerReturnProject, setViewerReturnProject] = useState<ProjectRecord | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [reportProject, setReportProject] = useState<ProjectRecord | null>(null);
  const [boardProject, setBoardProject] = useState<ProjectRecord | null>(null);
  const [bomProject, setBomProject] = useState<ProjectRecord | null>(null);

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
          onNavigate={navigate}
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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-7rem] size-[28rem] rounded-full bg-[var(--page-blob-1)] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] size-[26rem] rounded-full bg-[var(--page-blob-2)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 py-4 lg:flex lg:gap-6 lg:px-5">
        <Sidebar
          activeItem={view === "updates" ? "updates" : activeSection}
          onSelect={navigate}
        />
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2"
        >
          <div className="relative">
            <CircuitTrace scrollRef={mainRef} pageKey={view} />
            {/* lg:pl-12 / lg:pr-12 reserve gutter corridors for the circuit trace spine on both sides */}
            <div className="relative z-10 lg:pl-12 lg:pr-12">{view === "updates" ? <Updates /> : portfolioContent}</div>
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
        FORCE_SKELETONS ? (
          <ResumeViewerSkeleton onDismiss={() => setResumeOpen(false)} />
        ) : (
          <Suspense fallback={<ResumeViewerSkeleton />}>
            <ResumeViewer open={resumeOpen} onOpenChange={setResumeOpen} />
          </Suspense>
        )
      ) : null}

      <SkeletonPreviewBadge />

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
