# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (Vite)
pnpm build        # production build
pnpm preview      # preview production build
```

No lint or test scripts are configured.

## Architecture

Single-page React 18 portfolio site built with Vite + Tailwind CSS v4.

**Entry point:** `src/main.tsx` → `src/app/src/app/App.tsx`

The nested `src/app/src/app/` path is an artifact of the project structure; the real source lives there, not in the top-level `src/`.

**Routing:** No React Router routes — navigation is pure state. `Layout.tsx` owns a `currentPage: PageId` state and renders the active page component in a switch. The `Sidebar` calls `onPageChange` to switch pages. All modal/overlay state (selected project, organization modal, resume viewer, 3D board viewer, BOM viewer, report viewer) is also lifted into `Layout`.

**Data layer:** All portfolio content lives in `src/app/src/app/data/portfolio.ts` — a single TypeScript file exporting typed records (`ProfileRecord`, `ProjectRecord`, `OrganizationRecord`, `ExperienceRecord`, etc.) and lookup helpers like `getOrganizationById`. This is the only place to add/edit resume content, projects, organizations, and the Updates feed entries.

**Key page components** (all in `src/app/src/app/components/`):
- `Home` — landing with typed phrases and featured project cards
- `Projects` — masonry grid with featured/all toggle and hover previews
- `Experience` — timeline with organization context modal trigger
- `Updates` — chronological build/activity feed driven by `portfolio.ts` data
- `ProjectModal` — full project detail sheet; can open 3D viewer, report, BOM from here
- `BoardViewer` — Three.js PCB 3D viewer (VRML/board files from `public/`)
- `InteractiveBomViewer` — iframe wrapper for KiCad interactive BOM HTML files

**Styling:** Tailwind CSS v4 (config via `@tailwindcss/vite` plugin, no `tailwind.config.*` file). shadcn/ui components live in `components/ui/`. Theme tokens (CSS variables for blob colors, etc.) are in `src/app/src/styles/`. Dark/light mode toggled via `ThemeProvider` using `next-themes`; theme key is `portfolio-theme` in localStorage.

**Path alias:** `@` resolves to `./src` (repo root `src/`, not the nested app `src/`).

**Tooling notes:**
- Rollup is patched to use `@rollup/wasm-node` (see `tools/patch-rollup-native.mjs`) — this runs automatically via `postinstall`.
- `tools/build-brick-geometry.mjs` and `tools/flatten-vrml.mjs` are one-off asset pipeline scripts for 3D PCB data, not part of the build.
