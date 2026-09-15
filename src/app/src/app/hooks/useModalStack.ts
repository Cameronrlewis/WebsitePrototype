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
  // moves straight from one viewer to the next via transferViewer below,
  // without transiting restore() or touching returnProject - returnProject is
  // already correct from when the first viewer was opened, so the handoff
  // just swaps which viewer is showing.
  const transferViewer = useCallback(
    (fromSetter: (value: null) => void, toSetter: (project: ProjectRecord) => void) =>
      (project: ProjectRecord) => {
        fromSetter(null);
        toSetter(project);
      },
    [],
  );

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
    organizationToProject: transferViewer(setSelectedOrganization, setSelectedProject),
    openResume: useCallback(() => setResumeOpen(true), []),
    closeResume: useCallback(() => setResumeOpen(false), []),
    openReport: openViewer(setReportProject),
    closeReport: closeViewer(setReportProject),
    openBoard: openViewer(setBoardProject),
    closeBoard: closeViewer(setBoardProject),
    openBom: openViewer(setBomProject),
    closeBom: closeViewer(setBomProject),
    boardToBom: transferViewer(setBoardProject, setBomProject),
  };
}
