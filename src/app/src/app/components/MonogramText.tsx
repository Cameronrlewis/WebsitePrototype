import { cn } from "./ui/utils";

interface MonogramTextProps {
  value: string;
  className?: string;
}

export function MonogramText({ value, className }: MonogramTextProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-center leading-none translate-x-[0.05em] translate-y-[0.04em]",
        className,
      )}
    >
      {value}
    </span>
  );
}
