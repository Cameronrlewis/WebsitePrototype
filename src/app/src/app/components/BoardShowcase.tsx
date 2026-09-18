import { useEffect, useRef, useState } from "react";

import { scrollProgress } from "../lib/board-spin";
import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface BoardShowcaseProps {
  asset: "power" | "control" | "brick";
  title: string;
  caption: string;
}

// The block only has to travel far enough for the orbit to read as deliberate.
// Progress is measured against the wrapper, so this height is the whole curve.
const BLOCK_HEIGHT = "h-[26rem] md:h-[34rem]";

/**
 * A non-interactive board that turns once as it crosses the viewport. It reuses
 * the modal viewer's iframe shell in `mode=cinematic`, so no geometry, renderer,
 * or dependency is duplicated. The geometry payload is between 1MB and 4MB, so
 * the iframe is not mounted at all until the block is close to the viewport.
 */
export function BoardShowcase({ asset, title, caption }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  // Mount once, near the viewport, and never unmount: remounting would refetch
  // the geometry every time the block scrolls away.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver !== "function") {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Same handshake the modal viewer uses: hold the skeleton until the shell has
  // actually rendered a frame, rather than clearing on the iframe load event.
  useEffect(() => {
    if (!mounted) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const type = (event.data as { type?: unknown } | null)?.type;
      if (type === "viewer-ready" || type === "viewer-error") {
        setSceneReady(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted]);

  useEffect(() => {
    if (!sceneReady) {
      return;
    }

    const send = (progress: number) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "spin", progress }, window.location.origin);
    };

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      // One fixed mid-orbit pose, and no listener at all.
      send(0.5);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      send(scrollProgress(rect.top, rect.height, window.innerHeight));
    };

    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    // The portfolio scrolls inside <main>, not the window, so listen in the
    // capture phase to catch the scroll wherever it happens.
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [sceneReady]);

  const showBoard = sceneReady && !FORCE_SKELETONS;

  return (
    <div
      ref={wrapperRef}
      data-board-showcase={asset}
      className={`relative w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] ${BLOCK_HEIGHT}`}
    >
      {mounted ? (
        <iframe
          ref={iframeRef}
          title={`${title} rotating board render`}
          src={`/portfolio/assets/viewers/board-viewer-shell.html?asset=${asset}&mode=cinematic`}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          className={`pointer-events-none block h-full w-full border-0 bg-[#0c0c14] transition-opacity duration-700 ${showBoard ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.92)] to-transparent px-6 pb-6 pt-16">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        <p className="mt-1 font-display text-lg text-white">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-white/60">{caption}</p>
      </div>
    </div>
  );
}
