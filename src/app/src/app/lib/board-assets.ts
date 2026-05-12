import type { ProjectRecord } from "../data/portfolio";

export interface BoardMeshData {
  color: [number, number, number];
  v: number[];
  n?: number[];
  i: number[];
}

export interface BoardGeometryData {
  meshes: BoardMeshData[];
}

interface BoardAssetBundle {
  power: BoardGeometryData;
  control: BoardGeometryData;
  brick: BoardGeometryData;
}

interface BomBundle {
  power: string;
  control: string;
}

declare global {
  interface Window {
    __portfolioBoardGeometryPromise?: Promise<BoardAssetBundle>;
    __portfolioBomPromise?: Promise<BomBundle>;
  }
}

const modelUrl = "/portfolio/assets/scripts/viewer/board-model-data.js";
const viewerUrl = "/portfolio/assets/scripts/viewer/board-viewer.js";

function extractConstValue(source: string, marker: string, nextMarker?: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Unable to find ${marker}`);
  }

  const valueStart = markerIndex + marker.length;
  const valueEnd = nextMarker ? source.indexOf(nextMarker, valueStart) : source.lastIndexOf(";");
  if (valueEnd === -1) {
    throw new Error(`Unable to parse ${marker}`);
  }

  return source.slice(valueStart, valueEnd).trim().replace(/;$/, "");
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.text();
}

export async function loadBoardGeometry() {
  if (!window.__portfolioBoardGeometryPromise) {
    window.__portfolioBoardGeometryPromise = fetchText(modelUrl).then((source) => {
      const powerRaw = extractConstValue(source, "const PCB_GEO = ", "\nconst PCB_GEO_CTRL = ");
      const controlRaw = extractConstValue(source, "const PCB_GEO_CTRL = ", "\nconst PCB_GEO_BRICK = ");
      const brickRaw = extractConstValue(source, "const PCB_GEO_BRICK = ");

      return {
        power: JSON.parse(powerRaw) as BoardGeometryData,
        control: JSON.parse(controlRaw) as BoardGeometryData,
        brick: JSON.parse(brickRaw) as BoardGeometryData,
      };
    });
  }

  return window.__portfolioBoardGeometryPromise;
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
