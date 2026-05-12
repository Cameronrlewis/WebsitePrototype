# Cameron Lewis Portfolio

A Vite, React, and TypeScript portfolio prototype for Cameron Lewis. The site presents electrical engineering experience, education, skills, contact details, and detailed hardware project writeups with interactive project media.

## Features

- Responsive sidebar app shell with light and dark themes.
- Portfolio sections for Home, Experience, Projects, Skills, Education, and Contact.
- Featured project grid with detailed project modals.
- Project organization context pages for team and personal work.
- Interactive 3D PCB viewers for Aux Control Board, Aux Power Board, and Brick Buck Board.
- Interactive BOM viewer support for PCB projects.
- Resume and report document viewers.
- Served portfolio assets for project imagery, PDFs, board models, and BOM files.

## Tech Stack

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 4
- Radix UI / shadcn-style primitives
- `motion` for UI animation
- Three.js for board viewers
- PDF.js for document rendering

## Getting Started

Use Node.js 20 or newer.

```bash
npx pnpm@latest install
npx pnpm@latest dev
```

The development server will print a local URL, usually `http://localhost:5173`.

## Useful Commands

```bash
npx pnpm@latest dev
npx pnpm@latest build
npx pnpm@latest preview
```

- `npx pnpm@latest dev` starts the local Vite development server.
- `npx pnpm@latest build` creates a production build in `dist/`.
- `npx pnpm@latest preview` serves the production build locally.

If `npx` reports an npm cache permissions error on macOS, run the same command with a temporary cache:

```bash
env npm_config_cache=/private/tmp/npm-cache npx pnpm@latest install
```

## Project Structure

```text
src/app/src/app/
  App.tsx                 Main application entry
  components/             Portfolio pages, modals, viewers, and layout pieces
  data/portfolio.ts       Typed portfolio content and project records
  lib/                    Shared helpers for assets and viewer behavior
  styles/globals.css      Theme tokens and global styles

public/portfolio/
  assets/media/           Project, logo, and document preview imagery
  assets/documents/       Resume and report documents
  assets/viewers/         3D board viewer shell and model assets
  assets/bom/             Interactive BOM HTML assets

tools/
  build-brick-geometry.mjs
  patch-rollup-native.mjs
```

## Content Updates

Most portfolio copy, links, project metadata, and asset paths live in `src/app/src/app/data/portfolio.ts`. Project media should be added under `public/portfolio/assets/media/projects` and referenced from the typed data source.

3D board models use prebuilt geometry bundles served from `public/portfolio/assets/scripts/viewer/board-model-data.js`. Regenerate the Brick Buck bundle with the geometry build tool when its source board model changes.

## Notes

The contact form is local prototype behavior only. It does not submit to a backend service.
