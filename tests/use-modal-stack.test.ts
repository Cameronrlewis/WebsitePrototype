// @vitest-environment jsdom
//
// Scoped to jsdom via the per-file pragma above rather than flipping
// vitest.config.ts's global `environment` - the other 8 files in tests/
// run under "node" today and pass; changing the default risks all of them
// for one new file. environmentMatchGlobs/projects would also work but
// means editing the shared config for a single test file - the pragma gets
// the same isolation with a zero-line config diff.
//
// No @testing-library/react in package.json, so this drives the hook with
// a tiny hand-rolled harness: a host component calls useModalStack and
// hands its return value out through a ref on every render, and act() (from
// react-dom/test-utils, bundled with the already-installed react-dom) wraps
// each state-changing call. Both react and react-dom are already
// dependencies - no new devDependency was added.

import { createElement, type MutableRefObject, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProjectRecord } from "../src/app/src/app/data/portfolio";
import { useModalStack } from "../src/app/src/app/hooks/useModalStack";

// React only treats act() as real act() when this flag is set; without it every
// call logs "testing environment is not configured to support act(...)" and the
// updates are not guaranteed to be flushed before the assertions run.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useModalStack> & { selectedProject: ProjectRecord | null };

function makeProject(id: number, slug: string): ProjectRecord {
  return {
    id,
    slug,
    organizationId: "paradigm-engineering",
    title: `Project ${slug}`,
    category: "board",
    featured: false,
    description: "test fixture",
    tags: [],
  };
}

function Harness({ apiRef }: { apiRef: MutableRefObject<Api | null> }) {
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const modals = useModalStack({ selectedProject, setSelectedProject });
  apiRef.current = { ...modals, selectedProject };
  return null;
}

describe("useModalStack", () => {
  let container: HTMLDivElement;
  let root: Root;
  let apiRef: MutableRefObject<Api | null>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    apiRef = { current: null } as MutableRefObject<Api | null>;
    act(() => {
      root = createRoot(container);
      root.render(createElement(Harness, { apiRef }));
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function api(): Api {
    if (!apiRef.current) throw new Error("harness did not render");
    return apiRef.current;
  }

  it("opens and closes a viewer with no return target", () => {
    const project = makeProject(1, "solo");
    act(() => {
      api().openBoard(project, false);
    });
    expect(api().boardProject).toEqual(project);
    expect(api().selectedProject).toBeNull();

    act(() => {
      api().closeBoard();
    });
    expect(api().boardProject).toBeNull();
    // opened with returnToProject=false, so closing must NOT resurrect a project
    expect(api().selectedProject).toBeNull();
  });

  it("closing a report opened from a project returns to that project, not nothing", () => {
    const project = makeProject(2, "report-target");
    act(() => {
      api().openReport(project, true);
    });
    expect(api().reportProject).toEqual(project);
    expect(api().selectedProject).toBeNull();

    act(() => {
      api().closeReport();
    });
    // This is the exact regression e2e/modal-transitions.spec.ts:59 guards against:
    // closing the report used to leave nothing on screen instead of restoring
    // the originating project modal.
    expect(api().reportProject).toBeNull();
    expect(api().selectedProject).toEqual(project);
  });

  it("unwinds a 3-deep stack (org -> board viewer -> BOM) in order", () => {
    const project = makeProject(3, "deep-stack");

    // 1. project modal -> board viewer, remembering the project to return to
    act(() => {
      api().openBoard(project, true);
    });
    expect(api().boardProject).toEqual(project);
    expect(api().selectedProject).toBeNull();

    // 2. board viewer -> BOM viewer, a straight handoff (no returnProject churn)
    act(() => {
      api().boardToBom(project);
    });
    expect(api().boardProject).toBeNull();
    expect(api().bomProject).toEqual(project);

    // 3. closing the BOM viewer unwinds all the way back to the project modal
    act(() => {
      api().closeBom();
    });
    expect(api().bomProject).toBeNull();
    expect(api().selectedProject).toEqual(project);
  });

  it("opening an organization from a project modal restores the project on close", () => {
    const project = makeProject(4, "org-return");
    act(() => {
      api().openOrganization(project, true);
    });
    expect(api().selectedOrganization?.id).toBe("paradigm-engineering");
    expect(api().selectedProject).toBeNull();

    act(() => {
      api().closeOrganization();
    });
    expect(api().selectedOrganization).toBeNull();
    expect(api().selectedProject).toEqual(project);
  });
});
