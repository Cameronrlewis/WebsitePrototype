import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import { documents } from "../data/portfolio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

interface ResumeViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The résumé is a single page, so this renders the pre-built page-1 raster
// instead of rasterising the PDF in the browser. That removes pdfjs-dist (a
// ~362 KB lazy chunk plus a worker fetch) from this route. tools/build-resume-
// preview.mjs refuses to generate a preview for a PDF with more than one page,
// which is what keeps this approach honest if the résumé ever grows.
export function ResumeViewer({ open, onOpenChange }: ResumeViewerProps) {
  const [loadError, setLoadError] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1380px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1380px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--outline-soft)] px-6 py-4 pr-18 sm:pr-20">
            <div className="min-w-0">
              <DialogTitle className="text-xl text-[var(--text-strong)]">Cameron Lewis - Resume</DialogTitle>
              <DialogDescription className="sr-only">Preview of the resume, with links to download or open the PDF.</DialogDescription>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button
                asChild
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
              >
                <a href={documents.resume} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open PDF
                </a>
              </Button>
              <Button asChild className="rounded-[1rem] shadow-[var(--shadow-button)]">
                <a href={documents.resume} download>
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-4)] p-6">
            {loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="font-display text-lg font-semibold text-[var(--text-strong)]">
                  The resume preview could not be loaded.
                </p>
                <p className="max-w-sm text-sm text-[var(--text-soft)]">
                  The preview image failed to load. You can still download the PDF directly.
                </p>
                <a
                  href={documents.resume}
                  download
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-button)]"
                >
                  <Download className="size-4" />
                  Download resume
                </a>
              </div>
            ) : (
              <div className="flex min-h-full justify-center">
                <img
                  src={documents.resumePreview}
                  alt="Cameron Lewis resume, page 1. Download the PDF for the full document."
                  width={1700}
                  height={2200}
                  decoding="async"
                  className="h-auto w-full max-w-5xl rounded-[1rem] bg-white shadow-[var(--shadow-strong)]"
                  onError={() => setLoadError(true)}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
