import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  BODY_HALF,
  DIGIT_SEGMENTS,
  FLOW_PERIOD,
  FLOW_SPEED,
  FLOW_WINDOW,
  NET_TAG_HALF_H,
  NET_TAG_NOTCH,
  SEGMENT_LINES,
  type Branch,
  type Marker,
  type OverlayComponent,
  type OverlayType,
  type TraceGeometry,
} from "./CircuitTrace.constants";
import { buildTrace, netTagBodyWidth, netTagSpan } from "./CircuitTrace.geometry";

interface CircuitTraceProps {
  scrollRef: RefObject<HTMLElement | null>;
  pageKey: string;
}
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Schematic symbols, drawn for vertical flow (+y); rotated -90° for horizontal.
function symbolFor(type: OverlayType, sub: string[] = []): ReactNode {
  switch (type) {
    case "diode":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "zener":
      return (
        <>
          <path d="M-8 -8 L8 -8 L0 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="-8" y1="8" x2="-11" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="8" x2="11" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
    case "crystal":
      return (
        <>
          <line x1="-8" y1="-7" x2="8" y2="-7" stroke="currentColor" strokeWidth="2" />
          <rect x="-6" y="-4" width="12" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="7" x2="8" y2="7" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "switch":
      return (
        <>
          <circle cx="0" cy="-8" r="2" fill="currentColor" />
          <line x1="0" y1="-8" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="8" r="2" fill="currentColor" />
        </>
      );
    case "battery":
      return (
        <>
          <line x1="-10" y1="-3" x2="10" y2="-3" stroke="currentColor" strokeWidth="2" />
          <line x1="-5" y1="3" x2="5" y2="3" stroke="currentColor" strokeWidth="3" />
        </>
      );
    case "fuse":
      return (
        <>
          <rect x="-5" y="-10" width="10" height="20" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <line x1="0" y1="-10" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "polcap":
      return (
        <>
          <line x1="-9" y1="-4" x2="9" y2="-4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M-9 7 Q0 1 9 7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="12" y1="-9" x2="18" y2="-9" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="-12" x2="15" y2="-6" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "potentiometer":
      return (
        <>
          <path d="M0 -14 L7 -10 L-7 -6 L7 -2 L-7 2 L7 6 L0 10 L0 14" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="16" y1="0" x2="9" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 0 L14 -3 L14 3 Z" fill="currentColor" />
        </>
      );
    case "ground":
      return (
        <>
          <line x1="0" y1="-14" x2="0" y2="2" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-9" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="2" />
          <line x1="-6" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="2" />
          <line x1="-3" y1="10" x2="3" y2="10" stroke="currentColor" strokeWidth="2" />
        </>
      );
    case "opamp":
      return (
        <>
          <path d="M-11 -9 L11 -9 L0 11 Z" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-6" y1="-5" x2="-2" y2="-5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-4" y1="-7" x2="-4" y2="-3" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="-5" x2="6" y2="-5" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "ic":
      return (
        <>
          {/* Through-pins along the wire axis so the series current lands on
              real pins (top/bottom center), not the bare package body. */}
          <line x1="0" y1="-16" x2="0" y2="-13" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="13" x2="0" y2="16" stroke="currentColor" strokeWidth="1.5" />
          {/* Decorative side pins */}
          <line x1="-14" y1="-8" x2="-10" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="8" x2="-10" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="-8" x2="14" y2="-8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-10" y="-13" width="20" height="26" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-6" cy="-9" r="1.5" fill="currentColor" />
        </>
      );
    case "transformer":
      return (
        <>
          <path d="M-5 -12 Q-12 -9 -5 -6 Q-12 -3 -5 0 Q-12 3 -5 6 Q-12 9 -5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 -12 Q12 -9 5 -6 Q12 -3 5 0 Q12 3 5 6 Q12 9 5 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-1.5" y1="-12" x2="-1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1.5" y1="-12" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
        </>
      );
    case "rectifier":
      // Full AC→DC stage drawn horizontally: transformer, 4-diode bridge,
      // smoothing cap and load resistor shunted to ground off the DC rail.
      return (
        <>
          {/* Primary terminals (-68,±14) are fed by two bus leads drawn in emit */}
          {/* Transformer: primary (left) + secondary (right) windings, core between */}
          <path d="M-68 -14 Q-61 -10 -68 -6 Q-61 -2 -68 2 Q-61 6 -68 10 Q-61 14 -68 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M-48 -14 Q-55 -10 -48 -6 Q-55 -2 -48 2 Q-55 6 -48 10 Q-55 14 -48 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <line x1="-59" y1="-14" x2="-59" y2="14" stroke="currentColor" strokeWidth="1.1" />
          <line x1="-57" y1="-14" x2="-57" y2="14" stroke="currentColor" strokeWidth="1.1" />
          {/* Secondary: two leads routed up/down to the bridge top/bottom nodes,
              clear of the diodes */}
          <line x1="-48" y1="-14" x2="-48" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="-20" x2="-10" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="14" x2="-48" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-48" y1="20" x2="-10" y2="20" stroke="currentColor" strokeWidth="1.5" />
          {/* Diode bridge diamond */}
          <line x1="-34" y1="0" x2="-10" y2="-20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="-20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-34" y1="0" x2="-10" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-10" y1="20" x2="14" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {[
            // T→R and B→R point into DC+ (right); L→T and L→B point out of DC- (left)
            { x: 2, y: -10, angle: 40 },
            { x: 2, y: 10, angle: -40 },
            { x: -22, y: -10, angle: -40 },
            { x: -22, y: 10, angle: 40 },
          ].map(({ x, y, angle }) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path d="M-4 -4 L-4 4 L4 0 Z" fill="currentColor" />
              <line x1="4" y1="-4" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" />
            </g>
          ))}
          {[
            [-34, 0],
            [-10, -20],
            [14, 0],
            [-10, 20],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />
          ))}
          {/* DC- return from the left node down to ground */}
          <line x1="-34" y1="0" x2="-34" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-40" y1="10" x2="-28" y2="10" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-37" y1="13" x2="-31" y2="13" stroke="currentColor" strokeWidth="1.8" />
          <line x1="-35" y1="16" x2="-33" y2="16" stroke="currentColor" strokeWidth="1.8" />
          {/* DC+ rail */}
          <line x1="14" y1="0" x2="78" y2="0" stroke="currentColor" strokeWidth="1.5" />
          {/* Smoothing capacitor to ground */}
          <line x1="34" y1="0" x2="34" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="27" y1="8" x2="41" y2="8" stroke="currentColor" strokeWidth="2.2" />
          <path d="M27 15 Q34 10 41 15" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="22" y1="3" x2="27" y2="3" stroke="currentColor" strokeWidth="1.2" />
          <line x1="24.5" y1="0.5" x2="24.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="34" y1="15" x2="34" y2="19" stroke="currentColor" strokeWidth="1.5" />
          <line x1="28" y1="19" x2="40" y2="19" stroke="currentColor" strokeWidth="1.8" />
          <line x1="31" y1="22" x2="37" y2="22" stroke="currentColor" strokeWidth="1.8" />
          <line x1="33" y1="25" x2="35" y2="25" stroke="currentColor" strokeWidth="1.8" />
          {/* Load resistor to ground */}
          <line x1="58" y1="0" x2="58" y2="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M58 4 L63 7 L53 11 L63 15 L53 19 L58 22" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <line x1="58" y1="22" x2="58" y2="25" stroke="currentColor" strokeWidth="1.5" />
          <line x1="52" y1="25" x2="64" y2="25" stroke="currentColor" strokeWidth="1.8" />
          <line x1="55" y1="28" x2="61" y2="28" stroke="currentColor" strokeWidth="1.8" />
          <line x1="57" y1="31" x2="59" y2="31" stroke="currentColor" strokeWidth="1.8" />
          {/* Internal reference designators */}
          <text x="-66" y="-16" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[0] ?? "T1"}
          </text>
          <text x="43" y="12" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[1] ?? "C?"}
          </text>
          <text x="65" y="10" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.85">
            {sub[2] ?? "R?"}
          </text>
        </>
      );
    case "buck":
      // TPS54331-style switcher symbol, recreated from the datasheet: a
      // rectangular body with named pins. The surrounding sub-circuits are
      // emitted as real animated branches by emitBuckBlock.
      return (
        <>
          {/* Pin stubs — left: BOOT, VIN, EN; right: PH, VSENSE; bottom: SS, GND, COMP */}
          <line x1="-38" y1="-14" x2="-30" y2="-14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-38" y1="0" x2="-30" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-38" y1="14" x2="-30" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="0" x2="38" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-14" y1="22" x2="-14" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="22" x2="0" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="14" y1="22" x2="14" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-30" y="-22" width="60" height="44" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-25" cy="-17" r="1.4" fill="currentColor" />
          {/* Pin names */}
          <text x="-27" y="-12" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">BOOT</text>
          <text x="-27" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VIN</text>
          <text x="-27" y="16" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">EN</text>
          <text x="27" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">PH</text>
          <text x="27" y="16" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VSENSE</text>
          <text x="-14" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">SS</text>
          <text x="0" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="14" y="19" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">COMP</text>
          {/* Part number */}
          <text x="0" y="-4" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="currentColor">
            TPS54331
          </text>
        </>
      );
    case "mcu":
      // ESP32-S3-style module symbol with named pins; support circuitry is
      // emitted as animated branches by emitMcuBlock.
      return (
        <>
          {/* Pin stubs — left: EN, 3V3, IO0; right: TXD0, IO2, RXD0; bottom: XP, XN, GND */}
          <line x1="-43" y1="-16" x2="-35" y2="-16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-43" y1="0" x2="-35" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-43" y1="16" x2="-35" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="-16" x2="43" y2="-16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="0" x2="43" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="16" x2="43" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-12" y1="28" x2="-12" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="28" x2="12" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <line x1="24" y1="28" x2="24" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-35" y="-28" width="70" height="56" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-29" cy="-22" r="1.4" fill="currentColor" />
          {/* Pin names */}
          <text x="-32" y="-14" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">EN</text>
          <text x="-32" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">3V3</text>
          <text x="-32" y="18" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IO0</text>
          <text x="32" y="-14" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">TXD0</text>
          <text x="32" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IO2</text>
          <text x="32" y="18" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">RXD0</text>
          <text x="-12" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">XP</text>
          <text x="12" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">XN</text>
          <text x="24" y="25" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          {/* Part number */}
          <text x="0" y="-2" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor">
            ESP32-S3
          </text>
          <text x="0" y="8" textAnchor="middle" fontSize="4.5" fontFamily="monospace" fill="currentColor" opacity="0.7">
            WROOM-1
          </text>
        </>
      );
    case "ldo":
      // AMS1117-style 3-pin linear regulator.
      return (
        <>
          <line x1="-32" y1="0" x2="-24" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="24" y1="0" x2="32" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="16" x2="0" y2="22" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-24" y="-16" width="48" height="32" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <text x="-21" y="3" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VIN</text>
          <text x="21" y="3" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VOUT</text>
          <text x="0" y="13" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="0" y="-5" textAnchor="middle" fontSize="5.2" fontFamily="monospace" fill="currentColor">
            AMS1117
          </text>
          <text x="0" y="2" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.7">
            -1.8
          </text>
        </>
      );
    case "fpga":
      // iCE40-style FPGA package with banked pin names.
      return (
        <>
          {/* Left pins: CLK, VCCINT, IOL */}
          <line x1="-63" y1="-30" x2="-55" y2="-30" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-63" y1="0" x2="-55" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-63" y1="18" x2="-55" y2="18" stroke="currentColor" strokeWidth="1.5" />
          {/* Right pins: CRESET_B, CDONE, IOB */}
          <line x1="55" y1="-38" x2="63" y2="-38" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="-24" x2="63" y2="-24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="0" x2="63" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="55" y1="18" x2="63" y2="18" stroke="currentColor" strokeWidth="1.5" />
          {/* Bottom pins: decoupling + SPI bank */}
          <line x1="-30" y1="44" x2="-30" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-8" y1="44" x2="-8" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="44" x2="8" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="17" y1="44" x2="17" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="26" y1="44" x2="26" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="44" x2="35" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-55" y="-44" width="110" height="88" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-48" cy="-37" r="1.6" fill="currentColor" />
          <text x="-51" y="-28" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CLK</text>
          <text x="-51" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VCCINT</text>
          <text x="-51" y="20" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOL</text>
          <text x="51" y="-36" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CRESET_B</text>
          <text x="51" y="-22" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">CDONE</text>
          <text x="51" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOB</text>
          <text x="51" y="20" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">IOB</text>
          <text x="-30" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">VCC</text>
          <text x="-8" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">GND</text>
          <text x="8" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SS</text>
          <text x="17" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SCK</text>
          <text x="26" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SI</text>
          <text x="35" y="41" textAnchor="middle" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.9">SO</text>
          <text x="0" y="-6" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="currentColor">
            iCE40UP5K
          </text>
          <text x="0" y="6" textAnchor="middle" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            FPGA
          </text>
        </>
      );
    case "timer555":
      // NE555 in its classic astable dress.
      return (
        <>
          <line x1="-34" y1="0" x2="-26" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="26" y1="0" x2="34" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-16" y1="30" x2="-16" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="30" x2="0" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="16" y1="30" x2="16" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <line x1="16" y1="-30" x2="16" y2="-36" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-26" y="-30" width="52" height="60" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="-20" cy="-24" r="1.5" fill="currentColor" />
          <text x="-23" y="2" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">VCC</text>
          <text x="23" y="2" textAnchor="end" fontSize="4.8" fontFamily="monospace" fill="currentColor" opacity="0.9">OUT</text>
          <text x="-16" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">DIS</text>
          <text x="0" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">THR</text>
          <text x="16" y="27" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">CV</text>
          <text x="16" y="-24" textAnchor="middle" fontSize="4.2" fontFamily="monospace" fill="currentColor" opacity="0.9">RST</text>
          <text x="0" y="-8" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor">
            NE555
          </text>
        </>
      );
    case "flash8":
      // SPI configuration flash.
      return (
        <>
          <line x1="-13.5" y1="-18" x2="-13.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="-4.5" y1="-18" x2="-4.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="4.5" y1="-18" x2="4.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <line x1="13.5" y1="-18" x2="13.5" y2="-12" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-19" y="-12" width="38" height="24" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="-14" cy="-7" r="1.3" fill="currentColor" />
          <text x="0" y="1" textAnchor="middle" fontSize="5" fontFamily="monospace" fill="currentColor">
            W25Q32
          </text>
          <text x="0" y="8" textAnchor="middle" fontSize="3.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            SPI FLASH
          </text>
        </>
      );
    case "oscbox":
      // Canned oscillator.
      return (
        <>
          <line x1="12" y1="0" x2="18" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <rect x="-12" y="-10" width="24" height="20" rx="2" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.6" />
          <text x="0" y="-1" textAnchor="middle" fontSize="4.6" fontFamily="monospace" fill="currentColor">
            12MHz
          </text>
          <text x="0" y="6" textAnchor="middle" fontSize="3.8" fontFamily="monospace" fill="currentColor" opacity="0.7">
            OSC
          </text>
        </>
      );
    case "res":
      // Standalone zig-zag resistor for branch sub-circuits.
      return (
        <path
          d="M0 -10 L0 -8 L5 -6 L-5 -2 L5 2 L-5 6 L0 8 L0 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      );
    case "gndvia":
      // Ground via: a plated through-hole pad (ring + filled center).
      return (
        <>
          <circle cx="0" cy="0" r="4.5" fill="var(--surface-1)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="1.6" fill="currentColor" />
        </>
      );
    case "testpoint":
      return (
        <>
          <line x1="0" y1="-14" x2="0" y2="-4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
  }
}

export function CircuitTrace({ scrollRef, pageKey }: CircuitTraceProps) {
  const [geometry, setGeometry] = useState<TraceGeometry | null>(null);
  const litPathRef = useRef<SVGPathElement | null>(null);
  const litGlowRef = useRef<SVGPathElement | null>(null);
  const flowPathRef = useRef<SVGPathElement | null>(null);
  const boltRef = useRef<SVGGElement | null>(null);
  const componentRefs = useRef<Array<SVGGElement | null>>([]);
  const viaRefs = useRef<Array<SVGCircleElement | null>>([]);
  const junctionRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLitRefs = useRef<Array<SVGPathElement | null>>([]);
  const branchGlowRefs = useRef<Array<SVGPathElement | null>>([]);
  const branchBoltRefs = useRef<Array<SVGCircleElement | null>>([]);
  const branchLengthsRef = useRef<number[]>([]);
  const segmentRefs = useRef<Array<SVGLineElement | null>>([]);
  const netFlagRefs = useRef<Array<SVGGElement | null>>([]);
  const prevLitRef = useRef<boolean[]>([]);
  const totalLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastMeasureRef = useRef<string>("");
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

      // Skip rebuilds when the layout hasn't actually changed: the
      // ResizeObserver refires during load (fonts, lazy images), and each
      // setGeometry tears down/rebuilds the animation effect, which both
      // resets the scroll reveal and risks wedging the rAF loop.
      const signature = `${Math.round(width)}x${Math.round(height)}:${gaps
        .map((g) => `${Math.round(g.top)}-${Math.round(g.bottom)}`)
        .join(",")}`;
      if (signature === lastMeasureRef.current) {
        return;
      }
      lastMeasureRef.current = signature;

      setGeometry(buildTrace(width, height, gaps));
    };

    // Force a rebuild on mount and whenever the view (pageKey) changes.
    lastMeasureRef.current = "";
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

  // Drive the bolt, energized wake, branch fills, component lighting, and the display.
  useEffect(() => {
    if (!geometry || reducedMotion) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    // Invert the descent table: metric -> analytic path distance.
    const descent = geometry.descent;
    const distanceForMetric = (m: number): number => {
      if (descent.length === 0) {
        return 0;
      }
      if (m <= descent[0].metric) {
        return descent[0].dist;
      }
      const last = descent[descent.length - 1];
      if (m >= last.metric) {
        return last.dist;
      }
      let lo = 0;
      let hi = descent.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (descent[mid].metric <= m) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const a = descent[lo];
      const b = descent[hi];
      const t = (m - a.metric) / Math.max(1e-6, b.metric - a.metric);
      return a.dist + t * (b.dist - a.dist);
    };

    // Scroll maps linearly onto the descent metric, then to analytic distance,
    // then scaled into the DOM-measured length the dash offset expects.
    const targetDistance = () => {
      const containerScrolls = container.scrollHeight > container.clientHeight + 4;
      const scrollTop = containerScrolls ? container.scrollTop : window.scrollY;
      const maxScroll = containerScrolls
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
      const analytic = distanceForMetric(progress * geometry.totalMetric);
      return analytic * (totalLengthRef.current / Math.max(1, geometry.totalLength));
    };

    // The loop eases the displayed distance toward the scroll target each
    // frame (so dropped frames never read as stop-motion), keeps the flow
    // dashes marching for a moment after settling, then goes fully idle.
    let shown = 0;
    let prevShown = -1;
    let flowPhase = 0;
    let lastNow = performance.now();
    let settledAt = lastNow;
    let prevPct = -1;
    const prevVia: boolean[] = new Array(geometry.vias.length).fill(false);
    const prevJunction: boolean[] = new Array(geometry.junctions.length).fill(false);
    const prevFlag: boolean[] = new Array(geometry.netFlags.length).fill(false);
    const branchT: number[] = new Array(geometry.branches.length).fill(0);
    const branchStart: number[] = new Array(geometry.branches.length).fill(Number.NaN);
    const prevBranchT: number[] = new Array(geometry.branches.length).fill(-1);

    const update = (now: number) => {
      rafRef.current = null;
      const litPath = litPathRef.current;
      const bolt = boltRef.current;
      if (!litPath || !bolt) {
        return;
      }

      const dt = Math.min(64, now - lastNow);
      lastNow = now;
      const realLength = totalLengthRef.current;
      const target = targetDistance();
      // The reveal tracks the scroll target directly — the front's speed now
      // equals the scroll speed (constant descent), with no proportional lerp
      // that would make it accelerate to "catch up." A generous constant-
      // velocity cap only smooths huge single-frame jumps (fling / anchor
      // jumps) without reintroducing acceleration within a normal scroll.
      const maxStep = dt * 6;
      const diff = target - shown;
      if (Math.abs(diff) <= maxStep) {
        shown = target;
      } else {
        shown += Math.sign(diff) * maxStep;
      }

      // Analytic distance for triggers (branch fills, component lighting).
      const trigDist = (shown / Math.max(1, realLength)) * geometry.totalLength;
      let timedActive = false;

      if (shown !== prevShown) {
        const offset = `${realLength - shown}`;
        litPath.style.strokeDashoffset = offset;
        const glow = litGlowRef.current;
        if (glow) {
          glow.style.strokeDashoffset = offset;
        }

        const point = litPath.getPointAtLength(shown);
        bolt.setAttribute("transform", `translate(${point.x} ${point.y})`);

        // Seven-segment scroll percentage.
        if (geometry.display) {
          const pct = Math.round((shown / Math.max(1, realLength)) * 100);
          if (pct !== prevPct) {
            prevPct = pct;
            const chars = String(pct).padStart(3, " ");
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
        }
      }

      // Branch fills: scroll-coupled branches follow the front; timed
      // branches run their own power-on clock (per-pin speeds) once the
      // front passes their junction, and de-energize on scroll-back.
      for (let i = 0; i < geometry.branches.length; i += 1) {
        const branch = geometry.branches[i];
        const lit = branchLitRefs.current[i];
        const branchGlow = branchGlowRefs.current[i];
        const miniBolt = branchBoltRefs.current[i];
        const branchLength = branchLengthsRef.current[i] ?? 0;
        if (!lit || branchLength <= 0) {
          continue;
        }
        let t: number;
        if (branch.duration) {
          if (trigDist + 1 >= branch.junctionDist) {
            if (Number.isNaN(branchStart[i])) {
              branchStart[i] = now;
            }
            t = Math.min(1, Math.max(0, (now - branchStart[i] - (branch.delay ?? 0)) / branch.duration));
            if (t < 1) {
              timedActive = true;
            }
          } else {
            branchStart[i] = Number.NaN;
            t = 0;
          }
        } else {
          t = Math.min(1, Math.max(0, (trigDist - branch.junctionDist) / branch.fillWindow));
        }
        branchT[i] = t;
        if (t === prevBranchT[i]) {
          continue;
        }
        prevBranchT[i] = t;
        const branchOffset = `${branchLength * (1 - t)}`;
        lit.style.strokeDashoffset = branchOffset;
        if (branchGlow) {
          branchGlow.style.strokeDashoffset = branchOffset;
        }
        if (miniBolt) {
          if (t > 0 && t < 1) {
            const p = lit.getPointAtLength(t * branchLength);
            miniBolt.setAttribute("transform", `translate(${p.x} ${p.y})`);
            miniBolt.style.opacity = "1";
          } else {
            miniBolt.style.opacity = "0";
          }
        }
      }

      // Components, vias, and junctions only get style writes on the frame
      // their lit state actually flips. Parts on timed branches follow their
      // net's fill clock instead of the main trigger distance.
      for (let i = 0; i < geometry.components.length; i += 1) {
        const group = componentRefs.current[i];
        if (!group) {
          continue;
        }
        const comp = geometry.components[i];
        const passed =
          comp.branchIndex != null
            ? branchT[comp.branchIndex] + 0.001 >= (comp.branchFrac ?? 1)
            : comp.triggerDist <= trigDist + 1;
        if (passed === prevLitRef.current[i]) {
          continue;
        }
        prevLitRef.current[i] = passed;
        group.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
        group.style.filter = passed ? "drop-shadow(0 0 7px var(--primary))" : "none";
        if (passed) {
          group.style.animation = "none";
          void group.getBBox();
          group.style.animation = "circuit-pop 0.5s ease";
        } else {
          group.style.animation = "none";
        }
      }

      for (let i = 0; i < geometry.vias.length; i += 1) {
        const via = viaRefs.current[i];
        if (!via) {
          continue;
        }
        const passed = geometry.vias[i].triggerDist <= trigDist + 1;
        if (passed !== prevVia[i]) {
          prevVia[i] = passed;
          via.style.fill = passed ? "var(--primary)" : "var(--surface-1)";
        }
      }

      for (let i = 0; i < geometry.junctions.length; i += 1) {
        const junction = junctionRefs.current[i];
        if (!junction) {
          continue;
        }
        const passed = geometry.junctions[i].triggerDist <= trigDist + 1;
        if (passed !== prevJunction[i]) {
          prevJunction[i] = passed;
          junction.style.fill = passed ? "var(--primary)" : "var(--outline-strong)";
        }
      }

      for (let i = 0; i < geometry.netFlags.length; i += 1) {
        const flag = netFlagRefs.current[i];
        if (!flag) {
          continue;
        }
        const passed = geometry.netFlags[i].triggerDist <= trigDist + 1;
        if (passed !== prevFlag[i]) {
          prevFlag[i] = passed;
          flag.style.color = passed ? "var(--primary)" : "var(--outline-strong)";
        }
      }

      // Flow dashes: marching current confined to a trailing window behind
      // the bolt, built as a bounded dash list — no mask, no filter.
      const flow = flowPathRef.current;
      if (flow) {
        if (shown > 40) {
          flowPhase = (flowPhase + dt * FLOW_SPEED) % FLOW_PERIOD;
          const windowStart = Math.max(0, shown - FLOW_WINDOW);
          const lead = Math.max(0, windowStart + flowPhase - FLOW_PERIOD);
          const parts: string[] = [`0 ${lead.toFixed(1)}`];
          for (let covered = lead; covered < shown; covered += FLOW_PERIOD) {
            parts.push("6 14");
          }
          parts.push(`0 ${Math.ceil(realLength + 100)}`);
          flow.style.strokeDasharray = parts.join(" ");
        } else {
          flow.style.strokeDasharray = `0 ${Math.ceil(realLength + 100)}`;
        }
      }

      const moving = shown !== target || shown !== prevShown || timedActive;
      prevShown = shown;
      if (moving) {
        settledAt = now;
        if (flow) {
          flow.style.opacity = "1";
        }
        schedule();
      } else if (now - settledAt < 1500) {
        schedule();
      } else if (flow) {
        flow.style.opacity = "0";
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
      const glow = litGlowRef.current;
      if (glow) {
        glow.style.strokeDasharray = `${length}`;
        glow.style.strokeDashoffset = `${length}`;
      }
    }
    prevLitRef.current = new Array(geometry.components.length).fill(false);
    // Snap to the current scroll position so rebuilds (resize, content
    // changes) don't replay the reveal from the top.
    shown = targetDistance();

    branchLengthsRef.current = geometry.branches.map((_, i) => {
      const lit = branchLitRefs.current[i];
      if (!lit) {
        return 0;
      }
      const length = lit.getTotalLength();
      lit.style.strokeDasharray = `${length}`;
      lit.style.strokeDashoffset = `${length}`;
      const branchGlow = branchGlowRefs.current[i];
      if (branchGlow) {
        branchGlow.style.strokeDasharray = `${length}`;
        branchGlow.style.strokeDashoffset = `${length}`;
      }
      return length;
    });

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
        // Must clear the ref: schedule() only arms a frame when this is null,
        // so leaving a stale id here permanently wedges the loop after a
        // geometry rebuild interrupts a mid-flight frame.
        rafRef.current = null;
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
      {/* Ambient dormant network: fills the board with extra copper */}
      {geometry.ambientPaths.map((d, index) => (
        <path
          key={`ambient-${index}`}
          d={d}
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.22"
        />
      ))}
      {geometry.ambientPads.map((pad, index) => (
        <circle
          key={`pad-${index}`}
          cx={pad.x}
          cy={pad.y}
          r="3.5"
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="1.5"
          opacity="0.26"
        />
      ))}

      {/* Dormant trace */}
      <path
        d={geometry.path}
        fill="none"
        stroke="var(--outline-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {/* Dormant branch traces */}
      {geometry.branches.map((branch, index) => (
        <path
          key={`branch-dim-${index}`}
          d={branch.path}
          fill="none"
          stroke="var(--outline-strong)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity="0.6"
        />
      ))}

      {!reducedMotion ? (
        <>
          {/* Energized portion behind the bolt: soft glow underlay + bright
              core. Two plain strokes instead of an SVG filter so per-frame
              dashoffset updates never trigger full-page filter repaints. */}
          <path
            ref={litGlowRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.16"
          />
          <path
            ref={litPathRef}
            d={geometry.path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Flowing current: marching dashes confined to a trailing window
              behind the bolt (dasharray rebuilt per frame, no mask). */}
          <path
            ref={flowPathRef}
            d={geometry.path}
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 35%, white)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0 1000000"
            style={{ opacity: 0, transition: "opacity 0.6s ease" }}
          />

          {/* Energized branch fills (glow underlay + core) + mini-bolts */}
          {geometry.branches.map((branch, index) => (
            <path
              key={`branch-glow-${index}`}
              ref={(el) => {
                branchGlowRefs.current[index] = el;
              }}
              d={branch.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.16"
            />
          ))}
          {geometry.branches.map((branch, index) => (
            <path
              key={`branch-lit-${index}`}
              ref={(el) => {
                branchLitRefs.current[index] = el;
              }}
              d={branch.path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          ))}
          {geometry.branches.map((_, index) => (
            <circle
              key={`branch-bolt-${index}`}
              ref={(el) => {
                branchBoltRefs.current[index] = el;
              }}
              r="4"
              fill="var(--primary)"
              style={{ opacity: 0, filter: "drop-shadow(0 0 7px var(--primary))" }}
            />
          ))}

          {/* Traveling bolt: glow halo + bright core + radiating pulse ring */}
          <g ref={boltRef}>
            <circle r="16" fill="var(--primary)" opacity="0.14" />
            <circle r="9" fill="var(--primary)" opacity="0.4" />
            <circle r="4.5" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 10px var(--primary))" }} />
            <circle
              r="8"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              style={{
                animation: "circuit-pulse 1.6s ease-out infinite",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          </g>
        </>
      ) : null}

      {/* Schematic components: light up and pop as the current passes */}
      {geometry.components.map((component, index) => (
        <g
          key={`${component.type}-${component.x.toFixed(0)}-${component.y.toFixed(0)}`}
          transform={`translate(${component.x} ${component.y})${
            component.orientation === "h"
              ? ` rotate(${component.dir < 0 ? 90 : -90})`
              : component.dir < 0
                ? " rotate(180)"
                : ""
          } scale(${component.scale})`}
        >
          {/* Occluder: hides the wire (and its glow/flow dashes) under the
              symbol body so the trace reads as wired through the part. In
              local coords the wire always runs along +y, except the
              horizontal composites (rectifier, buck, mcu). */}
          {component.type === "ground" ||
          component.type === "testpoint" ||
          component.type === "gndvia" ||
          component.type === "flash8" ||
          component.type === "oscbox" ? null : component.type === "mcu" ? (
            // The ESP32 module is a single solid package, and its body fill
            // (--surface-1) is only 82% opaque — a wire passing under the body
            // outside the ±8 pin band would ghost through it instead of being
            // hidden. Occlude the whole package footprint (matches the body
            // rect below exactly: -35..35 × -28..28).
            <rect x={-35} y={-28} width={70} height={56} rx={2} fill="var(--background)" />
          ) : component.type === "rectifier" ||
            component.type === "buck" ||
            component.type === "ldo" ||
            component.type === "fpga" ||
            component.type === "timer555" ? (
            <rect
              x={-BODY_HALF[component.type]}
              y={-8}
              width={BODY_HALF[component.type] * 2}
              height={16}
              fill="var(--background)"
            />
          ) : (
            <rect x={-8} y={-BODY_HALF[component.type]} width={16} height={BODY_HALF[component.type] * 2} fill="var(--background)" />
          )}
          <g
            ref={(el) => {
              componentRefs.current[index] = el;
            }}
            style={{
              color: "var(--outline-strong)",
              transition: "color 0.3s ease",
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          >
            {symbolFor(component.type, component.labels)}
          </g>
        </g>
      ))}

      {/* Silkscreen: reference designators (static, muted) */}
      {geometry.texts.map((t, index) => (
        <text
          key={`ref-${index}`}
          x={t.x}
          y={t.y}
          fontSize={t.size}
          fontFamily="monospace"
          fill="var(--text-muted)"
          opacity="0.9"
          paintOrder="stroke"
          stroke="var(--background)"
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {t.text}
        </text>
      ))}

      {/* Net-name flags (AC IN, +12V, +3V3, GND): light as the current passes */}
      {geometry.netFlags.map((flag, index) => {
        // Schematic net-label tag: a pentagon whose point sits exactly on the
        // anchor (flag.x, flag.y) and whose body extends to `flag.side`.
        const dir = flag.side === "left" ? -1 : 1;
        const nose = NET_TAG_NOTCH * dir;
        const far = (NET_TAG_NOTCH + netTagBodyWidth(flag.text)) * dir;
        const h = NET_TAG_HALF_H;
        return (
          <g
            key={`net-${index}`}
            ref={(el) => {
              netFlagRefs.current[index] = el;
            }}
            transform={`translate(${flag.x} ${flag.y})`}
            style={{ color: "var(--outline-strong)", transition: "color 0.3s ease" }}
          >
            <path
              d={`M0 0 L${nose} ${-h} L${far} ${-h} L${far} ${h} L${nose} ${h} Z`}
              fill="var(--surface-1)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text
              x={(nose + far) / 2}
              y="3.8"
              textAnchor="middle"
              fontSize="11"
              fontFamily="monospace"
              fill="currentColor"
            >
              {flag.text}
            </text>
          </g>
        );
      })}

      {/* Vias at crossing bends */}
      {geometry.vias.map((via, index) => (
        <circle
          key={`via-${via.x.toFixed(0)}-${via.y.toFixed(0)}`}
          ref={(el) => {
            viaRefs.current[index] = el;
          }}
          cx={via.x}
          cy={via.y}
          r="5"
          fill="var(--surface-1)"
          stroke="var(--outline-strong)"
          strokeWidth="2"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}

      {/* Junction dots where branches split and merge */}
      {geometry.junctions.map((junction, index) => (
        <circle
          key={`junction-${junction.x.toFixed(0)}-${junction.y.toFixed(0)}`}
          ref={(el) => {
            junctionRefs.current[index] = el;
          }}
          cx={junction.x}
          cy={junction.y}
          r="4"
          fill="var(--outline-strong)"
          style={{ transition: "fill 0.3s ease" }}
        />
      ))}

      {/* Seven-segment scroll readout */}
      {geometry.display ? (
        <g transform={`translate(${geometry.display.x} ${geometry.display.y}) scale(1.6)`}>
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
