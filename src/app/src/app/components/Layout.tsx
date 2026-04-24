import { useEffect, useRef, useState } from "react";

import {
  getOrganizationById,
  type OrganizationRecord,
  type PageId,
  type ProjectRecord,
} from "../data/portfolio";
import { BoardViewer } from "./BoardViewer";
import { Contact } from "./Contact";
import { Education } from "./Education";
import { Experience } from "./Experience";
import { Home } from "./Home";
import { InteractiveBomViewer } from "./InteractiveBomViewer";
import { OrganizationContextModal } from "./OrganizationContextModal";
import { ProjectModal } from "./ProjectModal";
import { Projects } from "./Projects";
import { ReportViewer } from "./ReportViewer";
import { ResumeViewer } from "./ResumeViewer";
import { Sidebar } from "./Sidebar";
import { Skills } from "./Skills";

export function Layout() {
  const mainRef = useRef<HTMLElement | null>(null);
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [projectsViewMode, setProjectsViewMode] = useState<"all" | "featured">("featured");
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationRecord | null>(null);
  const [organizationReturnProject, setOrganizationReturnProject] = useState<ProjectRecord | null>(null);
  const [viewerReturnProject, setViewerReturnProject] = useState<ProjectRecord | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [reportProject, setReportProject] = useState<ProjectRecord | null>(null);
  const [boardProject, setBoardProject] = useState<ProjectRecord | null>(null);
  const [bomProject, setBomProject] = useState<ProjectRecord | null>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, projectsViewMode]);

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

  const pageContent = (() => {
    switch (currentPage) {
      case "home":
        return (
          <Home
            onNavigate={setCurrentPage}
            onOpenProject={setSelectedProject}
            onOpenOrganization={(project) => openOrganization(project, false)}
            onOpenResume={() => setResumeOpen(true)}
            onOpen3D={(project) => {
              setViewerReturnProject(null);
              setSelectedProject(null);
              setBoardProject(project);
            }}
          />
        );
      case "experience":
        return <Experience />;
      case "projects":
        return (
          <Projects
            onOpenProject={setSelectedProject}
            onOpenOrganization={(project) => openOrganization(project, false)}
            viewMode={projectsViewMode}
            onViewModeChange={setProjectsViewMode}
          />
        );
      case "skills":
        return <Skills />;
      case "education":
        return <Education />;
      case "contact":
        return <Contact onOpenResume={() => setResumeOpen(true)} />;
      default:
        return (
          <Home
            onNavigate={setCurrentPage}
            onOpenProject={setSelectedProject}
            onOpenOrganization={(project) => openOrganization(project, false)}
            onOpenResume={() => setResumeOpen(true)}
            onOpen3D={(project) => {
              setViewerReturnProject(null);
              setSelectedProject(null);
              setBoardProject(project);
            }}
          />
        );
    }
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-7rem] size-[28rem] rounded-full bg-[var(--page-blob-1)] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] size-[26rem] rounded-full bg-[var(--page-blob-2)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 py-4 lg:flex lg:gap-6 lg:px-5">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        <main ref={mainRef} className="min-w-0 flex-1 pb-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">
          {pageContent}
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

      <ResumeViewer open={resumeOpen} onOpenChange={setResumeOpen} />

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
