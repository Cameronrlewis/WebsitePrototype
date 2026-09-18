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

The pnpm version is pinned to `10.17.1` on every command below - resolving pnpm via the
unpinned `latest` tag currently pulls in a major version that silently drops the `overrides:`
block `package.json` uses to pin Vite and alias rollup, so don't "helpfully" bump this version back.

```bash
npx pnpm@10.17.1 install
npx pnpm@10.17.1 dev
```

The development server will print a local URL, usually `http://localhost:5173`.

## Useful Commands

```bash
npx pnpm@10.17.1 dev
npx pnpm@10.17.1 build
npx pnpm@10.17.1 preview
npx pnpm@10.17.1 typecheck
npx pnpm@10.17.1 test
npx pnpm@10.17.1 e2e
```

- `npx pnpm@10.17.1 dev` starts the local Vite development server.
- `npx pnpm@10.17.1 build` creates a production build in `dist/`.
- `npx pnpm@10.17.1 preview` serves the production build locally.
- `npx pnpm@10.17.1 typecheck` runs `tsc --noEmit`.
- `npx pnpm@10.17.1 test` runs the Vitest suite.
- `npx pnpm@10.17.1 e2e` runs the Playwright e2e suite (`e2e/*.spec.ts`) against a dev server it starts automatically. Run `npx playwright install chromium` once first to fetch the browser binary.

If `npx` reports an npm cache permissions error on macOS, run the same command with a temporary cache:

```bash
env npm_config_cache=/private/tmp/npm-cache npx pnpm@10.17.1 install
```

## Project Structure

```text
src/app/src/app/
  App.tsx                 Main application entry
  components/             Portfolio pages, modals, viewers, and layout pieces
  data/portfolio.ts       Typed portfolio content and project records
  hooks/                  Hash routing and modal stack state
  lib/                    Routing helpers, board asset loading
src/app/src/styles/
  index.css               Style entry (imports the two below)
  default_theme.css       Tailwind @theme inline block
  globals.css             Light and dark semantic tokens

public/portfolio/
  assets/media/           Project, logo, and document preview imagery
  assets/documents/       Resume and report documents
  assets/viewers/         3D board viewer shell and model assets
  assets/bom/             Interactive BOM HTML assets

tools/
  build-board-geometry-bin.mjs  Regenerates .pcbgeo viewer geometry
  build-brick-geometry.mjs      Brick Buck board geometry source build
  build-favicon-ico.mjs         Packs PNG icons into favicon.ico
  build-logo-light-variants.py  Generates light-theme logo variants
  build-resume-preview.mjs      Installs a resume PDF and renders its page-1 preview raster
  debug-vrml.mjs                VRML inspection helper
  flatten-vrml.mjs              VRML flattening helper
  optimize-media.py             Downscales and re-encodes project media
  patch-rollup-native.mjs       Rollup native-binary workaround
```

## Content Updates

Most portfolio copy, links, project metadata, and asset paths live in `src/app/src/app/data/portfolio.ts`. Project media should be added under `public/portfolio/assets/media/projects` and referenced from the typed data source.

The 3D board viewer fetches quantized binary geometry per board from
`public/portfolio/assets/viewers/geometry/<asset>.pcbgeo`, inside the viewer iframe.
Regenerate with `npx pnpm@10.17.1 build:geometry`.

## Notes

The contact section is a PCB-pinout layout with copy-to-clipboard, mailto, and direct
document links. There is no form and no backend service.
