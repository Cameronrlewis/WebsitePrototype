import type { ProjectRecord } from "../data/portfolio";

/**
 * Board 3D geometry is not loaded here - `board-viewer-shell.html` fetches its
 * own per-board binary payload from `assets/viewers/geometry/<asset>.pcbgeo`
 * inside the viewer iframe. This module only supplies the interactive BOM.
 */

const FETCH_TIMEOUT_MS = 15_000;

// One static IBOM export per board, checked into public/ - see M3 in the
// review remediation notes for why this replaced scraping two base64 blobs
// out of a 2MB bundled script that nothing else loaded.
const bomUrlByAsset: Record<string, string> = {
  power: "/portfolio/assets/bom/power/IBOM.html",
  control: "/portfolio/assets/bom/control/IBOM.html",
  brick: "/portfolio/assets/bom/brick-buck/IBOM.html",
};

async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.text();
}

export async function loadInteractiveBom(project: ProjectRecord) {
  const url = project.bomUrl ?? bomUrlByAsset[project.viewerAsset ?? "power"] ?? bomUrlByAsset.power;
  return fetchText(url);
}
