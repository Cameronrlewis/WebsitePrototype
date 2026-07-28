import { cn } from "./ui/utils";

type LogoProps = {
  className?: string;
};

/**
 * Brand mark: a "C" routed as a PCB copper trace with through-hole vias at each
 * end — the same geometry as `public/favicon.svg`, minus the board tile so it can
 * sit inside the sidebar's `bg-primary` circle. Strokes/fills use `currentColor`
 * and the via drills are punched out via `mask`, so the mark inherits whatever
 * foreground/background the theme provides.
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Cameron Lewis"
      className={cn("size-6", className)}
    >
      <mask id="logo-via-drills">
        <rect width="64" height="64" fill="white" />
        <circle cx="46" cy="17" r="2.6" fill="black" />
        <circle cx="46" cy="47" r="2.6" fill="black" />
      </mask>
      <g mask="url(#logo-via-drills)" fill="currentColor" stroke="currentColor">
        <path
          d="M46 17 L27 17 L17 27 L17 37 L27 47 L46 47"
          fill="none"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="46" cy="17" r="6.5" stroke="none" />
        <circle cx="46" cy="47" r="6.5" stroke="none" />
      </g>
    </svg>
  );
}

export default Logo;
