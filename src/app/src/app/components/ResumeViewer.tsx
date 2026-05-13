import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Minus, Plus, ScanSearch } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { documents } from "../data/portfolio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface ResumeViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeViewer({ open, onOpenChange }: ResumeViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);

  const zoomPercent = useMemo(() => Math.round((scale / fitScale) * 100), [fitScale, scale]);

  useEffect(() => {
    if (!open) {
      renderTaskRef.current?.cancel?.();
      pdfRef.current?.destroy();
      pdfRef.current = null;
      setCurrentPage(1);
      setTotalPages(1);
      setScale(1);
      setFitScale(1);
      if (canvasRef.current) {
        const context = canvasRef.current.getContext("2d");
        context?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    let cancelled = false;

    pdfjsLib.getDocument(documents.resume).promise.then(async (pdf) => {
      if (cancelled) {
        pdf.destroy();
        return;
      }

      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);

      const page = await pdf.getPage(1);
      if (cancelled) {
        return;
      }
      const nextFit = calculateFitScale(page, viewerRef.current);
      setFitScale(nextFit);
      setScale(nextFit);
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pdfRef.current || !canvasRef.current || !viewerRef.current) {
      return;
    }

    let cancelled = false;

    pdfRef.current.getPage(currentPage).then((page) => {
      if (cancelled || !canvasRef.current) {
        return;
      }

      renderTaskRef.current?.cancel?.();

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
    });

    return () => {
      cancelled = true;
    };
  }, [currentPage, open, scale]);

  useEffect(() => {
    if (!open || !viewerRef.current || !pdfRef.current) {
      return;
    }

    const observer = new ResizeObserver(async () => {
      if (!pdfRef.current) {
        return;
      }

      const page = await pdfRef.current.getPage(currentPage);
      const nextFit = calculateFitScale(page, viewerRef.current);
      setFitScale(nextFit);
    });

    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, [currentPage, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-h-[96vh] max-w-[min(1380px,calc(100vw-1rem))] overflow-hidden rounded-[1.8rem] border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-0 text-[var(--text-strong)] shadow-[var(--shadow-strong)] sm:max-w-[min(1380px,calc(100vw-2rem))]">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--outline-soft)] px-6 py-4 pr-18 sm:pr-20">
            <div className="min-w-0">
              <DialogTitle className="text-xl text-[var(--text-strong)]">Cameron Lewis - Resume</DialogTitle>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Interactive PDF preview with zoom and page controls.</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button variant="outline" className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]" onClick={() => setScale((current) => Math.max(fitScale * 0.5, current - fitScale * 0.2))}>
                <Minus className="size-4" />
              </Button>
              <div className="min-w-16 text-center text-sm text-[var(--text-body)]">{zoomPercent}%</div>
              <Button variant="outline" className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]" onClick={() => setScale((current) => Math.min(fitScale * 3, current + fitScale * 0.2))}>
                <Plus className="size-4" />
              </Button>
              <Button variant="outline" className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]" onClick={() => setScale(fitScale)}>
                <ScanSearch className="size-4" />
                Fit
              </Button>
              <Button asChild className="rounded-[1rem] shadow-[var(--shadow-button)]">
                <a href={documents.resume} download>
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--outline-soft)] px-6 py-3 text-sm text-[var(--text-soft)]">
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-[1rem] border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-[var(--text-strong)] hover:bg-[var(--surface-3)]"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>

          <div ref={viewerRef} className="min-h-0 flex-1 overflow-auto bg-[var(--surface-4)] p-6">
            <div className="flex min-h-full justify-center">
              <canvas ref={canvasRef} className="rounded-[1rem] bg-white shadow-[var(--shadow-strong)]" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function calculateFitScale(page: PDFPageProxy, viewer: HTMLDivElement | null) {
  const viewport = page.getViewport({ scale: 1 });
  const width = Math.max((viewer?.clientWidth ?? viewport.width) - 48, 320);
  return width / viewport.width;
}
