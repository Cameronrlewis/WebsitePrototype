import { useCallback, useState } from "react";

import { getOrganizationById, type OrganizationRecord, type ProjectRecord } from "../data/portfolio";

interface UseModalStackOptions {
  selectedProject: ProjectRecord | null;
  setSelectedProject: (project: ProjectRecord | null) => void;
}

export function useModalStack({ selectedProject, setSelectedProject }: UseModalStackOptions) {
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationRecord | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [reportProject, setReportProject] = useState<ProjectRecord | null>(null);
  const [boardProject, setBoardProject] = useState<ProjectRecord | null>(null);
  const [bomProject, setBomProject] = useState<ProjectRecord | null>(null);

  // A viewer opened from a project modal returns to it on close; one opened
  // from a card or the hero returns to the page. One ref covers every viewer
  // because only one is ever open at a time.
  const [returnProject, setReturnProject] = useState<ProjectRecord | null>(null);

  const restore = useCallback(() => {
    if (returnProject) {
      setSelectedProject(returnProject);
      setReturnProject(null);
    }
  }, [returnProject, setSelectedProject]);

  // A viewer-to-viewer handoff (e.g. BoardViewer's onOpenBom in Layout.tsx)
  // closes one viewer with closeViewer/closeOrganization, whose restore() call
  // sets selectedProject, then immediately opens the next with openViewer,
  // which sets selectedProject back to null. This only lands correctly
  // because both calls run inside one synchronous event handler: React 18
  // batches them into a single commit, so restore()'s intermediate value is
  // overwritten before anything renders. If a handoff like that is ever split
  // across an await, a setTimeout, or a network-gated loader, the two
  // setState calls land in separate commits and the project modal will flash
  // open for one frame between them.

  const openOrganizationById = useCallback((orgId: string) => {
    const organization = getOrganizationById(orgId);
    if (!organization) return;
    setReturnProject(null);
    setSelectedOrganization(organization);
  }, []);

  const openOrganization = useCallback(
    (project: ProjectRecord, restoreProject: boolean) => {
      const organization = getOrganizationById(project.organizationId);
      if (!organization) return;

      if (restoreProject) {
        setReturnProject(project);
        setSelectedProject(null);
      } else {
        setReturnProject(null);
      }

      setSelectedOrganization(organization);
    },
    [setSelectedProject],
  );

  const closeOrganization = useCallback(() => {
    setSelectedOrganization(null);
    restore();
  }, [restore]);

  const openViewer = useCallback(
    (setter: (project: ProjectRecord | null) => void) =>
      (project: ProjectRecord, returnToProject: boolean) => {
        setReturnProject(returnToProject ? project : null);
        setSelectedProject(null);
        setter(project);
      },
    [setSelectedProject],
  );

  const closeViewer = useCallback(
    (setter: (project: ProjectRecord | null) => void) => () => {
      setter(null);
      restore();
    },
    [restore],
  );

  return {
    selectedOrganization,
    resumeOpen,
    reportProject,
    boardProject,
    bomProject,
    openOrganizationById,
    openOrganization,
    closeOrganization,
    openResume: useCallback(() => setResumeOpen(true), []),
    closeResume: useCallback(() => setResumeOpen(false), []),
    openReport: useCallback(
      (project: ProjectRecord) => {
        setSelectedProject(null);
        setReportProject(project);
      },
      [setSelectedProject],
    ),
    closeReport: useCallback(() => setReportProject(null), []),
    openBoard: openViewer(setBoardProject),
    closeBoard: closeViewer(setBoardProject),
    openBom: openViewer(setBomProject),
    closeBom: closeViewer(setBomProject),
  };
}
