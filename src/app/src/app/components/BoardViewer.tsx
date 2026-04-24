import { useMemo, useRef } from "react";
import { Layers3, RotateCcw, ScanEye } from "lucide-react";

import type { ProjectRecord } from "../data/portfolio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

interface BoardViewerProps {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBom: (project: ProjectRecord) => void;
}

export function BoardViewer({ project, open, onOpenChange, onOpenBom }: BoardViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const viewerSrc = useMemo(() => {
    if (!project?.viewer3d) {
      return null;
    }

    const url = new URL("/portfolio/assets/viewers/board-viewer-shell.html", window.location.origin);
    url.searchParams.set("asset", project.viewerAsset === "control" ? "control" : "power");
    url.searchParams.set("title", project.title);
    return url.toString();
  }, [project]);

  const sendViewerCommand = (command: "reset" | "top" | "wireframe") => {
    iframeRef.current?.contentWindow?.postMessage({ type: command }, window.location.origin);
  };

  if (!project?.viewer3d || !viewerSrc) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1480px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1480px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-6 py-4 pr-18 sm:pr-20">
            <div>
              <DialogTitle className="text-xl text-[var(--text-strong)]">{project.title} - 3D Board Viewer</DialogTitle>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Rotate, inspect, switch to top view, or open the interactive BOM.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-body)] hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)]"
                onClick={() => sendViewerCommand("reset")}
              >
                <RotateCcw className="size-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-body)] hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)]"
                onClick={() => sendViewerCommand("top")}
              >
                <ScanEye className="size-4" />
                Top View
              </Button>
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-body)] hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)]"
                onClick={() => sendViewerCommand("wireframe")}
              >
                Wireframe
              </Button>
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-body)] hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)]"
                onClick={() => onOpenBom(project)}
              >
                <Layers3 className="size-4" />
                Interactive BOM
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-[#0c0c14]">
            <iframe
              ref={iframeRef}
              title={`${project.title} 3D board viewer`}
              src={viewerSrc}
              className="block h-full w-full border-0 bg-[#0c0c14]"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
