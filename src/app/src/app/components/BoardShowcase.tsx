import { useCallback, useEffect, useRef, useState } from "react";

import type { ShowcaseBoard } from "../data/portfolio";
import { BoardShowcaseFrame } from "./BoardShowcaseFrame";
import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface BoardShowcaseProps {
  boards: ShowcaseBoard[];
}

/**
 * A framed block that cycles through several non-interactive boards, each
 * orbiting while it is active and handing over to the next when it finishes
 * its guided tour. It reuses the modal viewer's iframe shell in
 * `mode=cinematic`.
 *
 * Geometry runs 1MB to 4MB per board, so the lead iframe waits for the block
 * to be near the viewport AND the browser to be idle, and the rest wait for
 * the lead to be live. A mounted board still holds a WebGL context and its
 * decoded geometry even while paused, so this block carries one permanent
 * context per board.
 */
export function BoardShowcase({ boards }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);
  // Assets whose shell reported viewer-error. Read by advance() to skip a
  // board that failed to load its geometry, so it cannot become a dead end
  // for the cycle. A ref, not state: handleReady can call advance() in the
  // same tick as the error that caused it (see below), and advance() must see
  // that error immediately rather than the state value from before it - a set
  // held in state and read by a callback closed over an earlier render would
  // still be one render behind at that point. It drives no rendering itself.
  const erroredAssetsRef = useRef<Set<string>>(new Set());
  // Only this - whether the lead specifically has failed - needs to be state,
  // since it changes what gets rendered (see the reduced-motion mount gate).
  const [leadErrored, setLeadErrored] = useState(false);
  // Assets whose shell has reported ready OR error - i.e. that have something
  // real to show (a rendered frame or an error card) rather than nothing yet.
  // The skeleton is held until the *active* board specifically is in this
  // set, not merely until the lead is, so a lead that fails does not dismiss
  // the skeleton onto an empty box while its fallback is still loading.
  const [readyAssets, setReadyAssets] = useState<ReadonlySet<string>>(() => new Set());
  const [reducedMotion, setReducedMotion] = useState(false);

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

  // Reacted to rather than read once: the non-lead boards' mount is gated on
  // this, and a live change (rare, but the query supports it) should still
  // take effect without a reload.
  useEffect(() => {
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!motionQuery) {
      return;
    }

    setReducedMotion(motionQuery.matches);
    const onChange = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener("change", onChange);
    return () => motionQuery.removeEventListener("change", onChange);
  }, []);

  // Pure: given the currently active index, find the next board that has not
  // errored, or fall back to the same index if every board has. Shared by the
  // ordinary handover (advance, below) and by the immediate recovery in
  // handleReady, so there is exactly one place that decides what "next"
  // means.
  const nextHealthyIndex = useCallback(
    (from: number) => {
      const total = boards.length;
      for (let step = 1; step <= total; step += 1) {
        const candidate = (from + step) % total;
        if (!erroredAssetsRef.current.has(boards[candidate].asset)) {
          return candidate;
        }
      }

      // Every board has errored: stay put rather than loop forever looking
      // for a healthy one. That reproduces the old single-board behaviour of
      // showing the shell's own error panel.
      return from;
    },
    [boards],
  );

  const advance = useCallback(() => {
    setActive((index) => nextHealthyIndex(index));
  }, [nextHealthyIndex]);

  const handleReady = useCallback(
    (asset: string, index: number, ok: boolean) => {
      if (!ok) {
        erroredAssetsRef.current.add(asset);
      }

      setReadyAssets((prev) => (prev.has(asset) ? prev : new Set(prev).add(asset)));

      // A failed lead board must still open the gate for the other boards, or
      // one failure turns into a blank block instead of a partial cycle - so
      // the gate is readyAssets (ready OR errored), not success.
      if (index === 0 && !ok) {
        setLeadErrored(true);
      }

      // A board's own shell is the only thing that can ever post tour-cycle,
      // and a board that just errored can never build a scene, enter its
      // orbit loop, or post that message - so if the board that just failed
      // is the one currently active, nothing else in the system will ever
      // move the cycle off it. Recover immediately rather than parking on
      // its error card with a healthy board sitting behind it at opacity-0.
      if (!ok) {
        setActive((current) => (current === index ? nextHealthyIndex(current) : current));
      }
    },
    [nextHealthyIndex],
  );

  const current = boards[active];
  const showBoard = readyAssets.has(current.asset) && !FORCE_SKELETONS;
  // The lead has something real to show - a frame or an error card - which is
  // exactly what readyAssets records, so it needs no state of its own.
  const leadReady = readyAssets.has(boards[0].asset);

  return (
    <div
      ref={wrapperRef}
      data-board-showcase=""
      className="relative h-[22rem] w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] md:h-[28rem]"
    >
      {mounted
        ? boards.map((board, index) => {
            // Only the lead board is mounted up front. The rest wait for it to
            // be live, and under reduced motion the orbit never advances past
            // a healthy lead board, so they would only ever download geometry
            // that could never be shown - unless the lead itself has errored,
            // in which case one of them is the only fallback there is.
            if (index > 0 && (!leadReady || (reducedMotion && !leadErrored))) {
              return null;
            }

            return (
              <div
                key={board.asset}
                data-board-frame={board.asset}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === active && showBoard ? "opacity-100" : "opacity-0"
                }`}
              >
                <BoardShowcaseFrame
                  asset={board.asset}
                  playing={visible && index === active}
                  reducedMotion={reducedMotion}
                  onReady={(ok) => handleReady(board.asset, index, ok)}
                  onCycleEnd={advance}
                />
              </div>
            );
          })
        : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.94)] via-[rgba(12,12,20,0.6)] to-transparent px-6 pb-5 pt-14">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        {/* Stacked in one grid cell and crossfaded on the same duration-700 as
            the board frames above, so the caption never reads a title for a
            board that has not visually arrived yet. */}
        <div className="mt-1 grid">
          {boards.map((board, index) => (
            <p
              key={board.asset}
              className={`col-start-1 row-start-1 font-display text-lg text-white transition-opacity duration-700 ${
                index === active && showBoard ? "opacity-100" : "opacity-0"
              }`}
            >
              {board.title}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
