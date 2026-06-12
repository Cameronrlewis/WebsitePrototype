import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface CircuitTraceProps {
  scrollRef: RefObject<HTMLElement | null>;
  pageKey: string;
}

type OverlayType = "led" | "capacitor" | "diode" | "mosfet";

interface OverlayComponent {
  x: number;
  y: number;
  type: OverlayType;
  orientation: "v" | "h";
}

interface TraceGeometry {
  path: string;
  components: OverlayComponent[];
  vias: Array<{ x: number; y: number }>;
  display: { x: number; y: number } | null;
  width: number;
  height: number;
}

const SPINE_X = 22;
const OVERLAY_CYCLE: OverlayType[] = ["led", "capacitor", "diode", "mosfet"];

// Seven-segment layout: A top, B top-right, C bottom-right, D bottom,
// E bottom-left, F top-left, G middle. Digit cell is 14x24.
const SEGMENT_LINES: Array<[number, number, number, number]> = [
  [2, 0, 12, 0], // A
  [14, 2, 14, 10], // B
  [14, 14, 14, 22], // C
  [2, 24, 12, 24], // D
  [0, 14, 0, 22], // E
  [0, 2, 0, 10], // F
  [2, 12, 12, 12], // G
];

const DIGIT_SEGMENTS: Record<string, number[]> = {
  "0": [0, 1, 2, 3, 4, 5],
  "1": [1, 2],
  "2": [0, 1, 6, 4, 3],
  "3": [0, 1, 6, 2, 3],
  "4": [5, 6, 1, 2],
  "5": [0, 5, 6, 2, 3],
  "6": [0, 5, 4, 3, 2, 6],
  "7": [0, 1, 2],
  "8": [0, 1, 2, 3, 4, 5, 6],
  "9": [0, 1, 2, 3, 5, 6],
  " ": [],
};

// Inline geometry: the wire itself becomes the component.
function verticalResistor(x: number, yStart: number): string {
  const amp = 7;
  let d = "";
  let y = yStart;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    y += 8;
    d += ` L${x + offset} ${y}`;
  }
  return d;
}

function verticalInductor(x: number, yStart: number): string {
  let d = "";
  let y = yStart;
  for (let i = 0; i < 4; i += 1) {
    d += ` Q${x + 14} ${y + 6} ${x} ${y + 12}`;
    y += 12;
  }
  return d;
}

function horizontalResistor(xStart: number, y: number): string {
  const amp = 7;
  let d = "";
  let x = xStart;
  const steps = [amp, -amp, amp, -amp, amp, 0];
  for (const offset of steps) {
    x += 8;
    d += ` L${x} ${y + offset}`;
  }
  return d;
}

function horizontalInductor(xStart: number, y: number): string {
  let d = "";
  let x = xStart;
  for (let i = 0; i < 4; i += 1) {
    d += ` Q${x + 6} ${y - 14} ${x + 12} ${y}`;
    x += 12;
  }
  return d;
}

const INLINE_SPAN = 48;

// Builds the route: a spine down the reserved left gutter, with a full-width
// horizontal excursion through every gap between page sections, schematic
// components scattered along the way, and a 7-seg readout in the last gap.
function buildTrace(width: number, height: number, gaps: Array<{ top: number; bottom: number }>): TraceGeometry {
  const rightX = Math.max(width - 26, SPINE_X + 200);
  const components: OverlayComponent[] = [];
  const vias: Array<{ x: number; y: number }> = [];
  let display: { x: number; y: number } | null = null;
  let overlayIndex = 0;
  let inlineToggle = 0;

  const nextOverlay = (): OverlayType => OVERLAY_CYCLE[overlayIndex++ % OVERLAY_CYCLE.length];

  let d = `M${SPINE_X} 0`;
  let y = 0;

  const emitSpineRun = (yEnd: number) => {
    const runLength = yEnd - y;
    if (runLength <= 0) {
      return;
    }

    // One inline component (resistor/inductor alternating) on runs long enough.
    if (runLength > 170) {
      const inlineY = y + runLength * 0.42 - INLINE_SPAN / 2;
      d += ` L${SPINE_X} ${inlineY.toFixed(1)}`;
      d += inlineToggle % 2 === 0 ? verticalResistor(SPINE_X, inlineY) : verticalInductor(SPINE_X, inlineY);
      inlineToggle += 1;
    }

    // Overlay components every ~300px on the lower half of the run.
    for (let oy = y + runLength * 0.62; oy < yEnd - 60; oy += 300) {
      components.push({ x: SPINE_X, y: oy, type: nextOverlay(), orientation: "v" });
    }

    d += ` L${SPINE_X} ${yEnd.toFixed(1)}`;
    y = yEnd;
  };

  const usableGaps = gaps.filter((gap) => gap.bottom - gap.top >= 70);

  usableGaps.forEach((gap, gapIndex) => {
    const crossY = (gap.top + gap.bottom) / 2 - 10;
    emitSpineRun(crossY - 20);

    // 45° into the gap, across, jog down, back, 45° out.
    d += ` L${SPINE_X + 20} ${crossY}`;
    vias.push({ x: SPINE_X + 20, y: crossY });

    const outboundStart = SPINE_X + 20;
    const inlineX = outboundStart + (rightX - outboundStart) * 0.3;
    d += ` L${inlineX.toFixed(1)} ${crossY}`;
    d += gapIndex % 2 === 0 ? horizontalResistor(inlineX, crossY) : horizontalInductor(inlineX, crossY);

    // Two overlay components on the visible outbound run.
    components.push({ x: outboundStart + (rightX - outboundStart) * 0.55, y: crossY, type: nextOverlay(), orientation: "h" });
    components.push({ x: outboundStart + (rightX - outboundStart) * 0.78, y: crossY, type: nextOverlay(), orientation: "h" });

    d += ` L${rightX} ${crossY}`;
    d += ` L${rightX} ${crossY + 14}`;
    vias.push({ x: rightX, y: crossY });

    const isLastGap = gapIndex === usableGaps.length - 1;
    if (isLastGap) {
      display = { x: rightX - 150, y: crossY + 22 };
    }

    d += ` L${SPINE_X + 20} ${crossY + 14}`;
    d += ` L${SPINE_X} ${crossY + 34}`;
    vias.push({ x: SPINE_X + 20, y: crossY + 14 });
    y = crossY + 34;
  });

  emitSpineRun(height - 4);

  return { path: d, components, vias, display, width, height };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Schematic symbols, drawn for vertical flow (+y); rotated -90° for horizontal.
function symbolFor(type: OverlayType): ReactNode {
  switch (type) {
    case "diode":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "led":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="-2" x2="16" y2="-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="3" x2="19" y2="-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "capacitor":
      return (
        <>
          <line x1="-9" y1="-4" x2="9" y2="-4" stroke="currentColor" strokeWidth="2.5" />
          <line x1="-9" y1="4" x2="9" y2="4" stroke="currentColor" strokeWidth="2.5" />
        </>
      );
    case "mosfet":
      return (
        <>
          <line x1="-15" y1="0" x2="-9" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-9" y1="-8" x2="-9" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="-5" y1="-8" x2="-5" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-5" y1="-8" x2="0" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-5" y1="8" x2="0" y2="8" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
  }
}

export function CircuitTrace({ scrollRef, pageKey }: CircuitTraceProps) {
  const [geometry, setGeometry] = useState<TraceGeometry | null>(null);
  const litPathRef = useRef<SVGPathElement | null>(null);
  const boltRef = useRef<SVGGElement | null>(null);
  const componentRefs = useRef<Array<SVGGElement | null>>([]);
  const viaRefs = useRef<Array<SVGCircleElement | null>>([]);
  const segmentRefs = useRef<Array<SVGLineElement | null>>([]);
  const totalLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  // Measure content + section gaps and (re)build the route.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const width = container.clientWidth;
      const height = container.scrollHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-section]"));
      const gaps: Array<{ top: number; bottom: number }> = [];
      for (let i = 0; i < sections.length - 1; i += 1) {
        gaps.push({
          top: sections[i].offsetTop + sections[i].offsetHeight,
          bottom: sections[i + 1].offsetTop,
        });
      }

      setGeometry(buildTrace(width, height, gaps));
    };

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

  // Drive the bolt, energized wake, component lighting, and the display.
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

      for (let i = 0; i < geometry.components.length; i += 1) {
        const group = componentRefs.current[i];
        if (group) {
          const passed = geometry.components[i].y <= point.y + 1;
          group.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
          group.style.filter = passed ? "drop-shadow(0 0 5px var(--primary))" : "none";
        }
      }

      for (let i = 0; i < geometry.vias.length; i += 1) {
        const via = viaRefs.current[i];
        if (via) {
          via.style.fill = geometry.vias[i].y <= point.y + 1 ? "var(--primary)" : "var(--surface-1)";
        }
      }

      // Seven-segment scroll percentage.
      if (geometry.display) {
        const chars = String(Math.round(progress * 100)).padStart(3, " ");
        for (let digit = 0; digit < 3; digit += 1) {
          const litSegments = DIGIT_SEGMENTS[chars[digit]] ?? [];
          for (let seg = 0; seg < 7; seg += 1) {
            const line = segmentRefs.current[digit * 7 + seg];
            if (line) {
              const lit = litSegments.includes(seg);
              line.style.stroke = lit ? "var(--primary)" : "var(--outline-strong)";
              line.style.opacity = lit ? "1" : "0.22";
            }
          }
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
      className="pointer-events-none absolute left-0 top-0 z-0 hidden lg:block"
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
        opacity="0.7"
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
            <circle r="3" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 8px var(--primary))" }} />
          </g>
        </>
      ) : null}

      {/* Schematic components: light up as the current passes */}
      {geometry.components.map((component, index) => (
        <g
          key={`${component.type}-${component.x.toFixed(0)}-${component.y.toFixed(0)}`}
          ref={(el) => {
            componentRefs.current[index] = el;
          }}
          transform={`translate(${component.x} ${component.y})${component.orientation === "h" ? " rotate(-90)" : ""}`}
          style={{ color: "var(--outline-strong)", transition: "color 0.3s ease, filter 0.3s ease" }}
        >
          {symbolFor(component.type)}
        </g>
      ))}

      {/* Vias at crossing bends */}
      {geometry.vias.map((via, index) => (
        <circle
          key={`via-${via.x.toFixed(0)}-${via.y.toFixed(0)}`}
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

      {/* Seven-segment scroll readout */}
      {geometry.display ? (
        <g transform={`translate(${geometry.display.x} ${geometry.display.y})`}>
          {[0, 1, 2].map((digit) =>
            SEGMENT_LINES.map(([x1, y1, x2, y2], seg) => (
              <line
                key={`seg-${digit}-${seg}`}
                ref={(el) => {
                  segmentRefs.current[digit * 7 + seg] = el;
                }}
                x1={x1 + digit * 22}
                y1={y1}
                x2={x2 + digit * 22}
                y2={y2}
                stroke="var(--outline-strong)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.22"
              />
            )),
          )}
          <text
            x={3 * 22 + 6}
            y="22"
            fill="var(--text-muted)"
            fontSize="13"
            fontFamily="monospace"
          >
            %
          </text>
        </g>
      ) : null}
    </svg>
  );
}
