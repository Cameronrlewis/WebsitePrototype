import { useCallback, useEffect, useRef, useState } from "react";

import { BoardShowcaseFrame } from "./BoardShowcaseFrame";
import { BoardViewerSkeleton, FORCE_SKELETONS } from "./Skeletons";

interface ShowcaseBoard {
  asset: "power" | "control" | "brick";
  title: string;
}

interface BoardShowcaseProps {
  boards: ShowcaseBoard[];
}

/**
 * A non-interactive board that orbits on a loop while it is on screen, the way
 * a looping clip would, handing over to the next board each time one finishes
 * its guided tour. It reuses the modal viewer's iframe shell in
 * `mode=cinematic`, so no geometry, renderer, or dependency is duplicated.
 *
 * Three things are gated rather than left running. The geometry payload runs
 * from roughly 1MB to 4MB depending on the board, so the first iframe is not
 * mounted until the block is near the viewport and the browser is idle, and
 * the rest are not mounted until the first one is live. And the shell only
 * renders frames between `play` and `pause`, so a board that is off screen or
 * waiting its turn costs nothing at all.
 */
export function BoardShowcase({ boards }: BoardShowcaseProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [leadReady, setLeadReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);

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

  const advance = useCallback(() => {
    setActive((index) => (index + 1) % Math.max(1, boards.length));
  }, [boards.length]);

  const current = boards[active];
  const showBoard = leadReady && !FORCE_SKELETONS;

  return (
    <div
      ref={wrapperRef}
      data-board-showcase=""
      className="relative h-[22rem] w-full overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[#0c0c14] shadow-[var(--shadow-card)] md:h-[28rem]"
    >
      {mounted
        ? boards.map((board, index) => {
            // Only the lead board is mounted up front. The rest wait for it to
            // be live, so the heaviest geometry never competes with the hero.
            if (index > 0 && !leadReady) {
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
                  title={board.title}
                  playing={visible && index === active}
                  onReady={index === 0 ? () => setLeadReady(true) : () => {}}
                  onCycleEnd={advance}
                />
              </div>
            );
          })
        : null}

      {showBoard ? null : <BoardViewerSkeleton label="Loading board render" />}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(12,12,20,0.94)] via-[rgba(12,12,20,0.6)] to-transparent px-6 pb-5 pt-14">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/45">In motion</p>
        <p className="mt-1 font-display text-lg text-white">{current ? current.title : ""}</p>
      </div>
    </div>
  );
}
