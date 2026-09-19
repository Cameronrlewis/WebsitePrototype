import { useEffect, useRef, useState } from "react";

interface BoardShowcaseFrameProps {
  asset: "power" | "control" | "brick";
  title: string;
  playing: boolean;
  onReady: (ok: boolean) => void;
  onCycleEnd: () => void;
}

/**
 * One board in the showcase: the iframe, the ready handshake, and the
 * play/pause messages. It owns no layout and no visibility logic; the
 * container decides which board is playing and which one is on top.
 */
export function BoardShowcaseFrame({ asset, title, playing, onReady, onCycleEnd }: BoardShowcaseFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // The callbacks come from the container and change identity on every render
  // there. Holding them in refs keeps the message listener from tearing down
  // and re-subscribing, which would drop a tour-cycle landing in the gap.
  // Assigned in an effect rather than during render, since writing a ref
  // during render is impure - a discarded concurrent render could leave the
  // ref pointing at a callback the committed tree never had.
  const readyRef = useRef(onReady);
  const cycleRef = useRef(onCycleEnd);
  useEffect(() => {
    readyRef.current = onReady;
    cycleRef.current = onCycleEnd;
  }, [onReady, onCycleEnd]);

  // Same handshake the modal viewer uses: hold the skeleton until the shell has
  // actually rendered a frame, rather than clearing on the iframe load event.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const type = (event.data as { type?: unknown } | null)?.type;
      if (type === "viewer-ready" || type === "viewer-error") {
        setSceneReady(true);
        readyRef.current(type === "viewer-ready");
      } else if (type === "tour-cycle") {
        cycleRef.current();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
        // One fixed mid-orbit pose, and the orbit never starts. With the orbit
        // parked there is no tour-cycle either, so the boards do not rotate.
        send({ type: "pause" });
        send({ type: "spin", progress: 0.5 });
        return;
      }

      send({ type: playing ? "play" : "pause" });
    };

    apply();
    motionQuery?.addEventListener("change", apply);
    return () => {
      motionQuery?.removeEventListener("change", apply);
      send({ type: "pause" });
    };
  }, [sceneReady, playing]);

  return (
    <iframe
      ref={iframeRef}
      aria-hidden="true"
      title={`${title} rotating board render`}
      src={`/portfolio/assets/viewers/board-viewer-shell.html?asset=${asset}&mode=cinematic`}
      sandbox="allow-scripts allow-same-origin"
      tabIndex={-1}
      className="pointer-events-none block h-full w-full border-0 bg-[#0c0c14]"
    />
  );
}
