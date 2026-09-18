import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "./utils";

const BASE_CLASSNAME =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";

const VARIANT_CLASSNAMES = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
} as const;

const SIZE_CLASSNAMES = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
} as const;

type ButtonVariant = keyof typeof VARIANT_CLASSNAMES;
type ButtonSize = keyof typeof SIZE_CLASSNAMES;

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(BASE_CLASSNAME, VARIANT_CLASSNAMES[variant], SIZE_CLASSNAMES[size], className)}
      {...props}
    />
  );
}

export { Button };
