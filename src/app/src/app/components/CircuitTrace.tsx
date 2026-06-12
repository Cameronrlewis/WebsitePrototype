import { useEffect, useRef, useState, type RefObject } from "react";

interface CircuitTraceProps {
  scrollRef: RefObject<HTMLElement | null>;
  pageKey: string;
}

interface TraceGeometry {
  path: string;
  vias: Array<{ x: number; y: number }>;
  width: number;
  height: number;
}

// Deterministic meander targets (fractions of content width) so the route
// is stable across re-renders and theme switches.
const X_TARGETS = [0.55, 0.16, 0.84, 0.3, 0.72, 0.1, 0.62, 0.88, 0.22, 0.48, 0.8, 0.14, 0.66, 0.36, 0.9];

// PCB-style route: vertical runs joined by 45° diagonals, top to bottom.
function buildTrace(width: number, height: number): TraceGeometry {
  const segmentDrop = 260;
  const points: Array<{ x: number; y: number }> = [];

  let y = 0;
  let index = 0;
  points.push({ x: X_TARGETS[0] * width, y: 0 });

  while (y < height) {
    const currentX = X_TARGETS[index % X_TARGETS.length] * width;
    const nextX = X_TARGETS[(index + 1) % X_TARGETS.length] * width;
    const diagonal = Math.abs(nextX - currentX); // 45° → dy == dx

    const runEnd = Math.min(y + segmentDrop, height);
    points.push({ x: currentX, y: runEnd });

    const diagEnd = runEnd + diagonal;
    if (diagEnd >= height) {
      break;
    }

    points.push({ x: nextX, y: diagEnd });
    y = diagEnd;
    index += 1;
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  // Vias at every bend (skip the start and end points).
  const vias = points.slice(1, -1);

  return { path, vias, width, height };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CircuitTrace({ scrollRef, pageKey }: CircuitTraceProps) {
  const [geometry, setGeometry] = useState<TraceGeometry | null>(null);
  const litPathRef = useRef<SVGPathElement | null>(null);
  const boltRef = useRef<SVGGElement | null>(null);
  const viaRefs = useRef<Array<SVGCircleElement | null>>([]);
  const totalLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  // Measure content and (re)build the route on page change and resize.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const width = container.clientWidth;
      const height = container.scrollHeight;
      if (width > 0 && height > 0) {
        setGeometry(buildTrace(width, height));
      }
    };

    // Wait a frame so the new page's content has laid out.
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [scrollRef, pageKey]);

  // Drive the bolt from scroll progress.
  useEffect(() => {
    if (!geometry || reducedMotion) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      rafRef.current = null;
      const litPath = litPathRef.current;
      const bolt = boltRef.current;
      if (!litPath || !bolt) {
        return;
      }

      const containerScrolls = container.scrollHeight > container.clientHeight + 4;
      const scrollTop = containerScrolls ? container.scrollTop : window.scrollY;
      const maxScroll = containerScrolls
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;

      const length = totalLengthRef.current;
      const distance = progress * length;
      litPath.style.strokeDashoffset = `${length - distance}`;

      const point = litPath.getPointAtLength(distance);
      bolt.setAttribute("transform", `translate(${point.x} ${point.y})`);

      // Light vias the bolt has passed.
      for (let i = 0; i < geometry.vias.length; i += 1) {
        const via = viaRefs.current[i];
        if (via) {
          via.style.fill = geometry.vias[i].y <= point.y ? "var(--primary)" : "var(--surface-1)";
        }
      }
    };

    const schedule = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    const litPath = litPathRef.current;
    if (litPath) {
      const length = litPath.getTotalLength();
      totalLengthRef.current = length;
      litPath.style.strokeDasharray = `${length}`;
      litPath.style.strokeDashoffset = `${length}`;
    }

    schedule();
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [geometry, reducedMotion, scrollRef]);

  if (!geometry) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0"
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      {/* Dormant trace */}
      <path
        d={geometry.path}
        fill="none"
        stroke="var(--outline-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.55"
      />

      {!reducedMotion ? (
        <>
          {/* Energized portion behind the bolt */}
          <path
            ref={litPathRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 70%, transparent))" }}
          />

          {/* Traveling bolt: glow halo + bright core */}
          <g ref={boltRef}>
            <circle r="11" fill="var(--primary)" opacity="0.18" />
            <circle r="6" fill="var(--primary)" opacity="0.45" />
            <circle
              r="3"
              fill="var(--primary)"
              style={{ filter: "drop-shadow(0 0 8px var(--primary))" }}
            />
          </g>
        </>
      ) : null}

      {/* Vias at each bend */}
      {geometry.vias.map((via, index) => (
        <circle
          key={`${via.x.toFixed(0)}-${via.y.toFixed(0)}`}
          ref={(el) => {
            viaRefs.current[index] = el;
          }}
          cx={via.x}
          cy={via.y}
          r="4"
          fill="var(--surface-1)"
          stroke="var(--outline-strong)"
          strokeWidth="2"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}
    </svg>
  );
}
