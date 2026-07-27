import type { ProjectRecord } from "../data/portfolio";

/**
 * Board 3D geometry is not loaded here - `board-viewer-shell.html` fetches its
 * own per-board binary payload from `assets/viewers/geometry/<asset>.bin.gz`
 * inside the viewer iframe. This module only supplies the interactive BOM.
 */

interface BomBundle {
  power: string;
  control: string;
}

declare global {
  interface Window {
    __portfolioBomPromise?: Promise<BomBundle>;
  }
}

const viewerUrl = "/portfolio/assets/scripts/viewer/board-viewer.js";

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.text();
}

function decodeBase64Html(payload: string) {
  return decodeURIComponent(escape(window.atob(payload)));
}

export async function loadInteractiveBom(project: ProjectRecord) {
  if (project.bomUrl) {
    return fetchText(project.bomUrl);
  }

  if (!window.__portfolioBomPromise) {
    window.__portfolioBomPromise = fetchText(viewerUrl).then((source) => {
      const ctrlMarker = 'var IBOM_B64_CTRL = "';
      const powerMarker = 'var IBOM_B64 = "';
      const powerStart = source.indexOf(powerMarker);
      const ctrlStart = source.indexOf(ctrlMarker);

      const power = powerStart === -1
        ? ""
        : source.slice(powerStart + powerMarker.length, source.indexOf('";', powerStart + powerMarker.length));
      const control = ctrlStart === -1
        ? power
        : source.slice(ctrlStart + ctrlMarker.length, source.indexOf('";', ctrlStart + ctrlMarker.length));

      return {
        power: decodeBase64Html(power),
        control: decodeBase64Html(control),
      };
    });
  }

  const bundle = await window.__portfolioBomPromise;
  if (project.viewerAsset === "control") {
    return bundle.control;
  }

  return bundle.power;
}
