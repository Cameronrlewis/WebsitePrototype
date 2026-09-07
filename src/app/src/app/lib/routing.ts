import { getProjectBySlug, type ProjectRecord } from "../data/portfolio";

export const SECTION_IDS = ["home", "education", "experience", "projects", "skills", "contact"] as const;

export type SectionId = (typeof SECTION_IDS)[number];
export type ViewId = "portfolio" | "updates";

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

// Parses "#/updates", "#/education", "#/projects/aux-power-board" so every
// view, section, and project stays deep-linkable.
export function parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null } {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, slug] = segments;

  if (first === "updates") {
    return { view: "updates", section: "home", project: null };
  }

  if (first === "projects" && slug) {
    const project = getProjectBySlug(slug);
    if (project) {
      return { view: "portfolio", section: "projects", project };
    }
  }

  if (first && isSectionId(first)) {
    return { view: "portfolio", section: first, project: null };
  }

  return { view: "portfolio", section: "home", project: null };
}
