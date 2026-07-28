import type { OrganizationRecord } from "../data/portfolio";
import { MonogramText } from "./MonogramText";
import { cn } from "./ui/utils";

interface OrganizationAvatarProps {
  organization: OrganizationRecord;
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string;
}

const sizeClasses = {
  sm: "size-10 text-sm",
  md: "size-12 text-base",
  lg: "size-16 text-xl",
} as const;

export function OrganizationAvatar({
  organization,
  size = "md",
  tone = "light",
  className,
}: OrganizationAvatarProps) {
  const isDark = tone === "dark";

  const useLightAsset = isDark && Boolean(organization.logoLight);

  if (organization.logo) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
          sizeClasses[size],
          isDark
            ? "border-[color:var(--org-chip-border)] bg-[var(--org-avatar-bg)]"
            : "border-[color:var(--outline-soft)] bg-[var(--surface-1)]",
          className,
        )}
      >
        <img
          src={useLightAsset ? organization.logoLight : organization.logo}
          alt=""
          className={cn(
            "size-[72%] object-contain",
            isDark && !useLightAsset && "brightness-0 invert",
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeClasses[size],
        isDark
          ? "bg-[var(--surface-4)] text-[var(--text-strong)]"
          : "bg-primary text-primary-foreground",
        className,
      )}
    >
      <MonogramText value={organization.monogram} className="tracking-[0.08em]" />
    </span>
  );
}
