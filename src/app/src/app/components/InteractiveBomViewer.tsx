import { useEffect, useState } from "react";

import type { ProjectRecord } from "../data/portfolio";
import { loadInteractiveBom } from "../lib/board-assets";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

interface InteractiveBomViewerProps {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InteractiveBomViewer({ project, open, onOpenChange }: InteractiveBomViewerProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project?.viewer3d) {
      return;
    }

    if (project.bomUrl) {
      setIframeUrl(project.bomUrl);
      return () => {
        setIframeUrl(null);
      };
    }

    let active = true;
    let createdUrl: string | null = null;

    loadInteractiveBom(project)
      .then((html) => {
        if (!active) {
          return;
        }

        createdUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        setIframeUrl(createdUrl);
      })
      .catch(() => {
        setIframeUrl(null);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      setIframeUrl(null);
    };
  }, [open, project]);

  if (!project?.viewer3d) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1520px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1520px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[color:var(--outline-soft)] px-6 py-4">
            <DialogTitle className="text-xl text-[var(--text-strong)]">{project.title} - Interactive BOM</DialogTitle>
          </div>
          <div className="min-h-0 flex-1 bg-white">
            {iframeUrl ? (
              <iframe title={`${project.title} interactive BOM`} src={iframeUrl} className="block h-full w-full bg-white" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-soft)]">Loading interactive BOM...</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
