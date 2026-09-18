import { useEffect, useRef, useState } from "react";

import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface BoardShowcaseProps {
  asset: "power" | "control" | "brick";
  title: string;
  caption: string;
}

/**
 * A non-interactive board that orbits on a loop while it is on screen, the way
 * a looping clip would. It reuses the modal viewer's iframe shell in
 * `mode=cinematic`, so no geometry, renderer, or dependency is duplicated.
 *
 * Two things are gated rather than left running. The geometry payload runs from
 * roughly 1MB to 4MB depending on the board, so the iframe is not mounted until
 * the block is near the viewport and the browser is idle. And the shell only
 * renders frames between `play` and `pause`, so once the block scrolls away the
 * second WebGL context costs nothing until it comes back.
 */
export function BoardShowcase({ asset, title, caption }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [visible, setVisible] = useState(false);

  // One observer drives both jobs: the first intersection mounts the iframe
  // (and is never undone, since remounting would refetch the geometry), and
  // every later crossing plays or pauses the orbit.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver !== "function") {
      setMounted(true);
      setVisible(true);
      return;
    }

    // The block sits high on the page, so it is usually already on screen at
    // first paint. Mounting straight away would put the geometry fetch in front
    // of the hero, so the mount waits for the browser to go idle. Visibility
    // tracking is not deferred: only the fetch is.
    let idle = 0;
    const mountWhenIdle = () => {
      if (idle) {
        return;
      }

      const request = window.requestIdleCallback;
      idle = typeof request === "function" ? request(() => setMounted(true), { timeout: 2500 }) : window.setTimeout(() => setMounted(true), 600);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        setVisible(isVisible);
        if (isVisible) {
          mountWhenIdle();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (idle) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idle);
        } else {
          window.clearTimeout(idle);
        }
      }
    };
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

    const send = (message: { type: string; progress?: number }) => {
      iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
    };

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const apply = () => {
      if (motionQuery?.matches) {
        // One fixed mid-orbit pose, and the orbit never starts.
        send({ type: "pause" });
        send({ type: "spin", progress: 0.5 });
        return;
      }

      send({ type: visible ? "play" : "pause" });
    };

    apply();
    motionQuery?.addEventListener("change", apply);
    return () => {
      motionQuery?.removeEventListener("change", apply);
      send({ type: "pause" });
    };
  }, [sceneReady, visible]);

  const showBoard = sceneReady && !FORCE_SKELETONS;

  return (
    <div
      ref={wrapperRef}
      data-board-showcase={asset}
      className="relative h-[22rem] w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] md:h-[28rem]"
    >
      {mounted ? (
        <iframe
          ref={iframeRef}
          aria-hidden="true"
          title={`${title} rotating board render`}
          src={`/portfolio/assets/viewers/board-viewer-shell.html?asset=${asset}&mode=cinematic`}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          className={`pointer-events-none block h-full w-full border-0 bg-[#0c0c14] transition-opacity duration-700 ${showBoard ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.94)] via-[rgba(12,12,20,0.6)] to-transparent px-6 pb-5 pt-14">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        <p className="mt-1 font-display text-lg text-white">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-white/60">{caption}</p>
      </div>
    </div>
  );
}
