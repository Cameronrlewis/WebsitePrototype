# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Single-page electrical-engineering portfolio for Cameron Lewis (cameron-lewis.com). Vite 6 + React 18 + TypeScript + Tailwind CSS 4 + Radix/shadcn primitives, `motion` for animation, Three.js for 3D board viewers, PDF.js for document viewers.

# Context Navigation
When you need to understand the codebase, docs, or any files in this project:
1. ALWAYS query the knowledge graph first: '/graphify query "your question"'
2. Only read raw files if I explicity say "read the file" or "look at the raw file"
3. Use 'graphify-out/wiki/index.md' as your navigation entrypoint for browsing structure

## Commands

Package manager is **pnpm** (Node 20+); the README drives everything through `npx pnpm@latest <cmd>`. There is no test suite, no lint script, and no `tsconfig.json` — Vite/esbuild transpiles TS without type-checking, and `build` does **not** run `tsc`, so type errors never fail a build. Verify changes by running the dev server and loading the page.

```bash
pnpm install     # postinstall runs tools/patch-rollup-native.mjs (rollup native-binary workaround)
pnpm dev         # Vite dev server, default http://localhost:5173
pnpm build       # production build to dist/ (vite build only — no typecheck)
pnpm preview     # serve the production build
```

If `pnpm` isn't installed, `npx pnpm@latest <cmd>` works. On macOS npm-cache permission errors: `env npm_config_cache=/private/tmp/npm-cache npx pnpm@latest install`.

**Rollup/Vite pinning.** `package.json` `pnpm.overrides` pins `vite` to `6.3.5` and aliases `rollup` → `@rollup/wasm-node` (the WASM build) to dodge the native-binary issue; `tools/patch-rollup-native.mjs` (postinstall) reinforces this. Don't bump Vite or unpin rollup casually — the build depends on this workaround.

## Directory layout (important — it's nested and duplicated)

The real application lives under **`src/app/src/app/`**, not `src/`. The entry chain:

- `index.html` loads `/src/main.tsx` and the Google Fonts `<link>` (Space Grotesk / Inter / JetBrains Mono — fonts are loaded here, referenced from CSS).
- `src/main.tsx` — the Vite entry at repo root. Bootstraps the theme (reads `localStorage["portfolio-theme"]` / `prefers-color-scheme`, toggles `.dark` on `<html>` **before render** to avoid a flash), then imports `App` from `./app/src/app/App.tsx` and styles from `./app/src/styles/index.css`, and mounts. Runtime theme state/persistence is managed by `components/ThemeProvider.tsx` (`STORAGE_KEY = "portfolio-theme"`).
- `src/app/src/app/App.tsx` — `ThemeProvider` + `MotionConfig reducedMotion="user"` wrapping `Layout`.
- Components in `src/app/src/app/components/`, content data in `src/app/src/app/data/`, 3D asset maps in `src/app/src/app/lib/`, styles in `src/app/src/styles/`.

`@` aliases to `./src` (see `vite.config.ts`). **The root-level `src/styles/` is a stale partial duplicate** — `main.tsx` imports `src/app/src/styles/index.css` (the only copy that also imports `globals.css`); edit the `src/app/src/styles/` copies, not `src/styles/`.

## Architecture

**Page composition.** `Layout.tsx` is the app shell: a `Sidebar` plus a scrollable `<main>` holding the portfolio. The portfolio is one vertical scroll of six sections rendered inline in `Layout.tsx` — `home / education / experience / projects / skills / contact` — each wrapped in a `<section data-section="…">` (`SECTION_IDS`). `Updates.tsx` is a **separate view** (hash `#/updates`), swapped in place of the portfolio, not part of the scroll. Navigation is hash-based: `parseHash` in `Layout.tsx` handles `#/education`, `#/projects/<slug>`, `#/updates`; a scroll-spy `IntersectionObserver` (`rootMargin: "-35% 0px -55% 0px"`) drives the sidebar highlight.

**CircuitTrace background animation — the critical coupling.** `CircuitTrace.tsx` renders an animated PCB "power chain" SVG behind the content, revealed on scroll. It **measures the rendered layout** rather than dictating it: it reads every `[data-section]` element's geometry (`offsetTop`/`offsetHeight`) and forms the inter-section gaps, then drops IC blocks (`centerpieceQueue` = `rectifier → buck → ldo → mcu → fpga → timer555`) one per gap. A gap is only usable when `gap.bottom - gap.top >= 70` (px), and the buck block needs horizontal room `avail ≥ 340` derived from the full `<main>` width. Consequences when editing section layout:

- Keep all six stacked `[data-section]` blocks; don't merge them, remove them, or make them side-by-side.
- Keep generous inter-section gaps. `Layout.tsx` uses `space-y-16 lg:space-y-24` (96px desktop). Reducing the desktop gap below ~70px drops **every** IC and leaves only the bare spine — this is silent and easy to cause with a "tighten the spacing" change.
- Keep `<main>` full-width (per-section `max-w` *inside* is fine) and keep the left/right gutter corridors (`lg:pl-12 lg:pr-12` on the content wrapper) clear for the trace.
- Section *internal* height can change freely — gaps are outer margins, independent of content height.

The main trunk carries a power-rail narrative (`AC IN → +12V → +3V3 → +1V8 → GND`) via `netFlags`; a `stage` machine (`input → rail12 → rail33 → rail18 → load`) advances as each converter block is placed and governs which decoupling parts sit on the bus.

**Content is data-driven.** `src/app/src/app/data/portfolio.ts` is the single source of truth for all page content — `profile`, `stats`, `experience`, `education`, `coursework`, `skillSets`, `projects`, `organizations`, and derived exports (`featuredBoardProjects`, and `updateFeed`, which is flattened from `organizations[].builds` where `showInUpdates`, sorted by `sortKey`). It also exports helpers `getOrganizationById` / `getProjectBySlug`. Editing content means editing this file, not the components. `lib/board-assets.ts` only handles the BOM — `loadInteractiveBom()` selects the IBOM/BOM per `project.viewerAsset`. **3D geometry never passes through the React app**: `board-viewer-shell.html` fetches its own board inside the viewer iframe (see Board geometry below).

**Styling.** Tailwind CSS v4 CSS-first via `@tailwindcss/vite` — **there is no `tailwind.config.*`** (a `postcss.config.mjs` exists at root, but Tailwind config is CSS-first). The CSS entry `src/app/src/styles/index.css` imports `default_theme.css` then `globals.css`:
- `src/app/src/styles/default_theme.css` holds the `@theme inline` block (colors, radii, `--font-display` / `--font-mono`).
- `src/app/src/styles/globals.css` holds the `:root` + `.dark` semantic tokens used directly in components as arbitrary values — `--surface-1..4`, `--text-strong/body/soft/muted`, `--outline-soft/strong`, `--shadow-card/soft/strong/button`, `--chip-*`, `--toggle-*`.

**Dark mode is the design target** (the `#10141c` / `#ff6b35` palette); the light theme exists but is secondary. Shared header styling is centralized in `components/SectionHeader.tsx` (mono numbered kicker + display title); titles use `font-display`, labels/eyebrows use `font-mono`, cards use `rounded-2xl` / `rounded-xl`.

**Assets & deploy.** Static project media (images, PDFs, board models, BOM files) is served from `public/portfolio/`. `public/CNAME` = `cameron-lewis.com` (a duplicate `CNAME` also sits at repo root) points the custom domain; `robots.txt` + `sitemap.xml` accompany it. Favicons are generated (`tools/build-favicon-ico.mjs` packs `icon-{16,32,48}.png` into `public/favicon.ico`); `tools/build_resume_improved.py` builds the résumé.

**Project media.** Card/media images are downscaled to 2400 px on the long edge and re-encoded to WebP by `python3 tools/optimize-media.py` (`--check` for a dry run); originals live in `assets-src/media-originals/`. The tool applies **EXIF orientation** and converts **wide-gamut ICC to sRGB** — skipping either ships photos sideways or oversaturated, which is how `aux-power-hiccup-fix.jpg` (EXIF orientation 6, Display P3) first went out wrong. It refuses to overwrite an already-archived original, so re-running is safe; if it errors about a collision, reconcile the two files by hand rather than deleting either. Sources: 23 MB → 0.75 MB.

**Board geometry — `assets-src/` holds build inputs; don't move them back into `public/`.** Two large trees live outside the deployed tree on purpose: `assets-src/board-geometry/board-model-data.js` (**51 MB**, the only source for the power and control boards) and `assets-src/board-geometry/brick-buck/` (**85 MB** of `.wrl`, the source `tools/build-brick-geometry.mjs` regenerates *brick* from). Neither is deleteable, and the `.wrl` tree must move as a unit — its `Inline` references to `shapes3D/` are relative. Unrelated despite the name: `public/portfolio/assets/bom/brick-buck/IBOM.html` is live via `project.bomUrl`.

What ships is `public/portfolio/assets/viewers/geometry/{power,control,brick}.pcbgeo` — one quantized binary per board (1.6 / 0.9 / 3.9 MB), produced by `pnpm build:geometry` (`tools/build-board-geometry-bin.mjs`, which documents the format and gates on a round-trip accuracy check). Positions are Uint16-quantized per mesh/axis and normals are omitted — the shell calls `computeVertexNormals()`. `board-viewer-shell.html` fetches only the board it needs. **The `.pcbgeo` extension is load-bearing:** the payload is gzip, and a `.gz` name makes servers set `Content-Encoding`, so the browser pre-inflates and the viewer's own inflate step dies with "Failed to decode data". The shell sniffs the gzip magic number rather than trusting the transport — keep both halves of that. After editing geometry, rerun `pnpm build:geometry` or the viewer serves stale boards.

## Gotchas

- **`node-local` is a ~230MB tracked file** (a bundled Node runtime, not a directory) in the repo, which makes `git status`/`add`/`commit` slow (multi-second index refresh). Expect git operations to lag; run them in the background if they exceed the tool timeout.
- No type-checking or tests gate anything, so a change that compiles under esbuild can still be type-incorrect — read surrounding code carefully rather than relying on a checker.
