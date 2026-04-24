import { AnimatePresence, motion } from "motion/react";

import type { ProjectRecord } from "../data/portfolio";
import { Badge } from "./ui/badge";

interface ProjectHoverPreviewProps {
  project: ProjectRecord | null;
  anchor: { x: number; y: number } | null;
}

export function ProjectHoverPreview({ project, anchor }: ProjectHoverPreviewProps) {
  const previewWidth = project?.hoverPreviewWidth ?? 448;
  const previewHeight = project?.hoverPreviewHeight ?? 420;
  const viewportWidth = typeof window === "undefined" ? previewWidth + 32 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
  const left = anchor
    ? Math.min(Math.max(anchor.x - previewWidth / 2, 16), Math.max(16, viewportWidth - previewWidth - 16))
    : 16;
  const top = anchor ? Math.min(Math.max(anchor.y - previewHeight / 2, 16), Math.max(16, viewportHeight - previewHeight - 16)) : 16;

  return (
    <AnimatePresence>
      {project && anchor ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed z-50 hidden overflow-hidden rounded-[1.6rem] border border-[#d9dde7] bg-white/98 shadow-[0_28px_80px_rgba(28,33,63,0.18)] lg:block"
          style={{
            width: `${Math.min(previewWidth, viewportWidth - 32)}px`,
            left: `${left}px`,
            top: `${top}px`,
          }}
        >
          {project.hoverImg || project.cardImg || project.bannerImg ? (
            <div
              className="overflow-hidden border-b border-[#d9dde7] bg-[#eef1f6]"
              style={{
                height: `${project.hoverMediaHeight ?? 208}px`,
                background: project.hoverBackground ?? "#eef1f6",
              }}
            >
              <img
                src={project.hoverImg ?? project.cardImg ?? project.bannerImg}
                alt={project.title}
                className="h-full w-full"
                style={{
                  objectFit: project.hoverContain ? "contain" : "cover",
                  objectPosition: project.hoverImgPosition ?? project.cardImgPosition ?? "center",
                  transform: project.hoverScale ? `scale(${project.hoverScale})` : undefined,
                  transformOrigin: "center",
                }}
              />
            </div>
          ) : null}
          <div className="space-y-4 p-5 text-[#27283c]">
            <div className="flex items-center gap-2">
              <Badge className="border-[#2d2c46]/10 bg-[#26243a] text-white">{project.category}</Badge>
              {project.status ? (
                <Badge className="border-[#d2d7e2] bg-[#f4f5f9] text-[#565b70]">
                  {project.status === "in-progress" ? "In Progress" : "Completed"}
                </Badge>
              ) : null}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#2a2c40]">{project.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#6e7487]">{project.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full border border-[#d2d7e2] bg-[#f4f5f9] px-3 py-1 text-xs text-[#4e5368]">
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#8b90a4]">Click for full project details</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
