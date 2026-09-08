import { lazy, Suspense, useRef, useState } from "react";

import type { SectionId } from "../lib/routing";
import { useHashRoute } from "../hooks/useHashRoute";
import { useModalStack } from "../hooks/useModalStack";
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
  const modals = useModalStack({ selectedProject, setSelectedProject });

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
          onOpenOrganization={(project) => modals.openOrganization(project, false)}
          onOpenResume={modals.openResume}
          onOpen3D={(project) => modals.openBoard(project, false)}
        />
      </section>

      <section ref={registerSection("education")} data-section="education" className={sectionClass}>
        <Education />
      </section>

      <section ref={registerSection("experience")} data-section="experience" className={sectionClass}>
        <Experience onOpenOrganization={modals.openOrganizationById} />
      </section>

      <section ref={registerSection("projects")} data-section="projects" className={sectionClass}>
        <Projects
          onOpenProject={setSelectedProject}
          onOpenOrganization={(project) => modals.openOrganization(project, false)}
          viewMode={projectsViewMode}
          onViewModeChange={setProjectsViewMode}
        />
      </section>

      <section ref={registerSection("skills")} data-section="skills" className={sectionClass}>
        <Skills />
      </section>

      <section ref={registerSection("contact")} data-section="contact" className={sectionClass}>
        <Contact onOpenResume={modals.openResume} />
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
          if (!open) setSelectedProject(null);
        }}
        onOpenOrganization={(project) => modals.openOrganization(project, true)}
        onOpen3D={(project) => modals.openBoard(project, true)}
        onOpenReport={modals.openReport}
        onOpenBom={(project) => modals.openBom(project, true)}
      />

      <OrganizationContextModal
        organization={modals.selectedOrganization}
        open={Boolean(modals.selectedOrganization)}
        onOpenChange={(open) => {
          if (!open) modals.closeOrganization();
        }}
        onOpenProject={(project) => {
          modals.closeOrganization();
          setSelectedProject(project);
        }}
      />

      {modals.resumeOpen ? (
        FORCE_SKELETONS ? (
          <ResumeViewerSkeleton onDismiss={modals.closeResume} />
        ) : (
          <Suspense fallback={<ResumeViewerSkeleton />}>
            <ResumeViewer open={modals.resumeOpen} onOpenChange={(open) => (open ? modals.openResume() : modals.closeResume())} />
          </Suspense>
        )
      ) : null}

      <SkeletonPreviewBadge />

      <ReportViewer
        project={modals.reportProject}
        open={Boolean(modals.reportProject)}
        onOpenChange={(open) => {
          if (!open) modals.closeReport();
        }}
      />

      <BoardViewer
        project={modals.boardProject}
        open={Boolean(modals.boardProject)}
        onOpenChange={(open) => {
          if (!open) modals.closeBoard();
        }}
        onOpenBom={(project) => {
          // These two must stay in one synchronous handler: React 18 batches
          // them, so closeBoard's restore of selectedProject/returnProject is
          // overwritten by openBom before anything commits. Put an await or a
          // setTimeout between them and the project modal flashes for a frame.
          modals.closeBoard();
          modals.openBom(project, true);
        }}
      />

      <InteractiveBomViewer
        project={modals.bomProject}
        open={Boolean(modals.bomProject)}
        onOpenChange={(open) => {
          if (!open) modals.closeBom();
        }}
      />
    </div>
  );
}
