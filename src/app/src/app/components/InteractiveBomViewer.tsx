import { useEffect, useState } from "react";

import type { ProjectRecord } from "../data/portfolio";
import { loadInteractiveBom } from "../lib/board-assets";
import { FORCE_SKELETONS, InteractiveBomSkeleton } from "./Skeletons";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

interface InteractiveBomViewerProps {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InteractiveBomViewer({ project, open, onOpenChange }: InteractiveBomViewerProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open || !project?.viewer3d) {
      return;
    }

    setFailed(false);

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
        if (!active) {
          return;
        }
        setIframeUrl(null);
        setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      setIframeUrl(null);
    };
  }, [open, project, retryToken]);

  if (!project?.viewer3d) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1520px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1520px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[color:var(--outline-soft)] px-6 py-4">
            <DialogTitle className="text-xl text-[var(--text-strong)]">{project.title} - Interactive BOM</DialogTitle>
            <DialogDescription className="sr-only">Interactive bill of materials for this board.</DialogDescription>
          </div>
          <div className="min-h-0 flex-1">
            {failed ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="font-mono text-sm text-[var(--text-soft)]">The interactive BOM could not be loaded.</p>
                <Button
                  variant="outline"
                  className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                  onClick={() => setRetryToken((token) => token + 1)}
                >
                  Retry
                </Button>
              </div>
            ) : iframeUrl && !FORCE_SKELETONS ? (
              <iframe
                title={`${project.title} interactive BOM`}
                src={iframeUrl}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="block h-full w-full bg-white"
              />
            ) : (
              <>
                <InteractiveBomSkeleton />
                <span className="sr-only" role="status">
                  Loading interactive BOM
                </span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
