import { Download } from "lucide-react";

import type { ProjectRecord } from "../data/portfolio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
interface ReportViewerProps {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportViewer({ project, open, onOpenChange }: ReportViewerProps) {
  if (!project?.reportPages?.length || !project.reportAsset) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1240px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1240px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--outline-soft)] px-6 py-4">
            <div>
              <DialogTitle className="text-xl text-[var(--text-strong)]">{project.title} - Engineering Report</DialogTitle>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Rendered report pages from the original portfolio site.</p>
            </div>
            <Button asChild className="rounded-[1rem] shadow-[var(--shadow-button)]">
              <a href={project.reportAsset} download>
                <Download className="size-4" />
                Download PDF
              </a>
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-4)]">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
              {project.reportPages.map((page, index) => (
                <img
                  key={page}
                  src={page}
                  alt={`${project.title} report page ${index + 1}`}
                  className="w-full rounded-[1rem] border border-[color:var(--outline-soft)] bg-white shadow-[var(--shadow-strong)]"
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
