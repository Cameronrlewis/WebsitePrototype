import { useEffect, useState } from "react";

import { cn } from "./ui/utils";

/**
 * Loading placeholders for the portfolio, styled as an unpopulated PCB rather
 * than the generic grey pulse: bare substrate, silkscreen outlines, copper
 * pads, and a sweep that reads as a signal propagating down a trace. Motion
 * lives in `globals.css` (`.skeleton`, `.skeleton-board`, `.skeleton-pad`) and
 * is disabled under `prefers-reduced-motion`.
 *
 * Every skeleton mirrors the dimensions of the content it stands in for, so
 * the swap to real content never shifts layout.
 */

/* --------------------------------------------------------------------------
 * TEMPORARY design-review flag. Remove once the skeleton pass is signed off.
 *
 *   ?skeleton=1      pin every loading placeholder open; the app stays
 *                    navigable so modals and viewers can still be opened
 *   ?skeleton=cards  the above, plus swap the projects grid for card skeletons
 *
 * Read once at module load - the query string cannot change without a reload
 * (navigation here is hash-based, which leaves the search params intact).
 * ----------------------------------------------------------------------- */
const skeletonParam =
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("skeleton");

export const FORCE_SKELETONS = skeletonParam !== null;
export const FORCE_CARD_SKELETONS = skeletonParam === "cards";

/** Corner badge so a pinned-open page is never mistaken for a broken one. */
export function SkeletonPreviewBadge() {
  if (!FORCE_SKELETONS) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[100] rounded-full border border-[color:var(--outline-strong)] bg-[var(--surface-1)] px-3 py-1.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)] shadow-[var(--shadow-soft)]">
      Skeleton preview{FORCE_CARD_SKELETONS ? " · cards" : ""} — drop ?skeleton to exit
    </div>
  );
}

/** Base substrate block. Everything else composes this. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  // `relative` leads so a caller passing `absolute` wins via tailwind-merge;
  // the `::after` sweep needs a positioned ancestor either way.
  return <div aria-hidden="true" className={cn("skeleton relative rounded-md", className)} {...props} />;
}

const LINE_WIDTHS = ["100%", "94%", "82%", "97%", "68%", "88%"];

/** Stacked text rails with uneven lengths so they scan as prose, not bars. */
export function SkeletonLines({
  lines = 3,
  className,
  lineClassName,
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("rounded-full h-3", lineClassName)}
          style={{ width: LINE_WIDTHS[index % LINE_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}

/** Four silkscreen corner brackets - the fiducial framing used board-wide. */
function CornerBrackets({ className }: { className?: string }) {
  const corners = [
    "left-3 top-3 border-l border-t",
    "right-3 top-3 border-r border-t",
    "left-3 bottom-3 border-b border-l",
    "right-3 bottom-3 border-b border-r",
  ];

  return (
    <>
      {corners.map((corner) => (
        <span
          key={corner}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute size-5 border-[color:color-mix(in_srgb,var(--outline-strong)_55%,transparent)]",
            corner,
            className,
          )}
        />
      ))}
    </>
  );
}

/**
 * Placeholder for a project card's image well. Absolutely positioned - drop it
 * inside the existing fixed-height well so the card height never changes.
 */
export function ImageWellSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("skeleton absolute inset-0 rounded-none", className)}>
      <CornerBrackets />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="skeleton-pad size-1.5 rounded-full bg-primary"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Image that holds a substrate placeholder until it decodes. Accepts the same
 * props as `<img>`; `wellClassName` styles the wrapper that owns the space.
 */
export function SkeletonImage({
  wellClassName,
  pendingWellClassName,
  className,
  style,
  onLoad,
  onError,
  ...props
}: React.ComponentProps<"img"> & {
  wellClassName?: string;
  /** Applied to the well only while loading - e.g. a min-height to reserve space. */
  pendingWellClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const settled = loaded && !FORCE_SKELETONS;

  useEffect(() => {
    setLoaded(false);
  }, [props.src]);

  // A cached image is already complete by the time the ref fires, and its
  // `load` event may have been missed entirely. Without this the skeleton
  // flashes on every mount - including remounts driven by a `key` change,
  // like the featured-board carousel - which reads as a glitch rather than
  // as loading.
  const captureImage = (node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true);
    }
  };

  return (
    <div className={cn("relative h-full w-full", wellClassName, settled ? undefined : pendingWellClassName)}>
      {settled ? null : <ImageWellSkeleton />}
      <img
        {...props}
        ref={captureImage}
        className={cn("transition-opacity duration-300", className)}
        // Hidden via inline style rather than an opacity class so callers that
        // set their own opacity (hero art at 80%) keep it once loaded.
        style={settled ? style : { ...style, opacity: 0 }}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoaded(true);
          onError?.(event);
        }}
      />
    </div>
  );
}

/**
 * Full project card placeholder, matched to the `Projects` grid card: image
 * well, org strip, meta row, title, body, tags, footer.
 */
export function ProjectCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]"
    >
      <div className={cn("relative border-b border-[color:var(--outline-soft)]", tall ? "h-56 md:h-80" : "h-56")}>
        <ImageWellSkeleton />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-2)] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="rounded-full h-3.5 w-32" />
              <Skeleton className="rounded-full h-3 w-20" />
            </div>
          </div>
          <Skeleton className="rounded-full h-6 w-16" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="rounded-full h-3 w-24" />
            <Skeleton className="rounded-full h-3 w-16" />
          </div>
          <Skeleton className="rounded-full h-5 w-3/4" />
          <SkeletonLines lines={3} lineClassName="h-3.5" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[64, 88, 52, 76].map((width, index) => (
            <Skeleton key={index} className="rounded-full h-7" style={{ width }} />
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <Skeleton className="rounded-full h-4 w-28" />
          <Skeleton className="rounded-full h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

/**
 * Dark substrate placeholder for the 3D board viewer. Matches the renderer
 * clear colour so the handoff to the live canvas is seamless.
 */
export function BoardViewerSkeleton({ label = "Loading board geometry" }: { label?: string }) {
  return (
    <div aria-hidden="true" className="skeleton skeleton-board absolute inset-0 z-10">
      {/* Mounting holes, one per corner. */}
      {["left-8 top-8", "right-8 top-8", "left-8 bottom-8", "right-8 bottom-8"].map((position) => (
        <span
          key={position}
          className={cn("absolute size-4 rounded-full border-2 border-[#46567c] bg-[#161d31]", position)}
        />
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        {/* IC outline with pin ticks - the shape the real board will occupy. */}
        <div className="relative h-28 w-44 rounded-[0.35rem] border border-[#55688f] bg-[#1c2540]">
          {/* Pin-1 dot. */}
          <span className="absolute left-3 top-3 size-2 rounded-full border border-[#6e82ad]" />
          <div className="absolute -left-3 top-4 flex h-[calc(100%-2rem)] flex-col justify-between">
            {[0, 1, 2, 3, 4].map((pin) => (
              <span
                key={pin}
                className="skeleton-pad h-[3px] w-3.5 rounded-sm bg-primary"
                style={{ animationDelay: `${pin * 110}ms` }}
              />
            ))}
          </div>
          <div className="absolute -right-3 top-4 flex h-[calc(100%-2rem)] flex-col justify-between">
            {[0, 1, 2, 3, 4].map((pin) => (
              <span
                key={pin}
                className="skeleton-pad h-[3px] w-3.5 rounded-sm bg-primary"
                style={{ animationDelay: `${(4 - pin) * 110}ms` }}
              />
            ))}
          </div>
        </div>

        <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#93a3c6]">{label}</p>
      </div>
    </div>
  );
}

/**
 * Document page placeholder - a sheet with a heading block and body rails.
 * Used for report pages, the interactive BOM, and the resume canvas.
 */
export function DocumentPageSkeleton({
  className,
  aspect = "aspect-[1/1.294]",
}: {
  className?: string;
  aspect?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative w-full overflow-hidden rounded-[1rem] border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-8 shadow-[var(--shadow-soft)]",
        aspect,
        className,
      )}
    >
      <CornerBrackets />
      <div className="flex h-full flex-col gap-6">
        <div className="space-y-3">
          <Skeleton className="rounded-full h-3 w-24" />
          <Skeleton className="rounded-full h-6 w-2/3" />
        </div>
        <SkeletonLines lines={4} />
        <Skeleton className="h-1/3 w-full rounded-[0.6rem]" />
        <SkeletonLines lines={3} className="mt-auto" />
      </div>
    </div>
  );
}

/**
 * Placeholder for the interactive BOM iframe: toolbar, board pane, and the
 * parts table, laid out the way the real IBOM renders.
 */
export function InteractiveBomSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-4 bg-[var(--surface-2)] p-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex items-center gap-2">
          {[72, 56, 56].map((width, index) => (
            <Skeleton key={index} className="h-7 rounded-[0.6rem]" style={{ width }} />
          ))}
        </div>
        <Skeleton className="rounded-full h-5 w-40" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative overflow-hidden rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)]">
          <ImageWellSkeleton className="rounded-none" />
        </div>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] p-4">
          <div className="grid grid-cols-[3rem_1fr_5rem] gap-3 border-b border-[color:var(--outline-soft)] pb-3">
            <Skeleton className="rounded-full h-3" />
            <Skeleton className="rounded-full h-3" />
            <Skeleton className="rounded-full h-3" />
          </div>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3 py-1.5">
              <Skeleton className="rounded-full h-3" />
              <Skeleton className="rounded-full h-3" style={{ width: LINE_WIDTHS[index % LINE_WIDTHS.length] }} />
              <Skeleton className="rounded-full h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Standalone modal shell shown while the resume viewer's lazy chunk and PDF.js
 * document are still in flight. Mirrors the real dialog's frame so the chrome
 * does not pop in.
 */
export function ResumeViewerSkeleton({ onDismiss }: { onDismiss?: () => void } = {}) {
  return (
    <div
      // Dismissable only in ?skeleton preview mode, where nothing ever finishes
      // loading behind it. As a Suspense fallback it is inert and aria-hidden.
      aria-hidden={onDismiss ? undefined : "true"}
      onClick={onDismiss}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4",
        onDismiss ? "cursor-pointer" : undefined,
      )}
    >
      <div className="flex h-[96vh] w-full max-w-[min(1380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.8rem] border border-[color:var(--outline-soft)] bg-[var(--surface-2)] shadow-[var(--shadow-strong)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--outline-soft)] px-6 py-4 pr-18 sm:pr-20">
          <div className="min-w-0 space-y-2">
            <Skeleton className="rounded-full h-5 w-56" />
            <Skeleton className="rounded-full h-3.5 w-72" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {[40, 64, 40].map((width, index) => (
              <Skeleton key={index} className="h-9 rounded-[1rem]" style={{ width }} />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-[var(--surface-4)] p-6">
          <DocumentPageSkeleton className="max-w-2xl" />
        </div>
      </div>
    </div>
  );
}
