# Portfolio Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding (High, Medium, Low) from the 2026-09-07 codebase review of cameron-lewis.com, ending with a site that passes WCAG 2.2 AA, loads no third-party scripts, and is gated by type-checking and tests in CI.

**Architecture:** Three sequential phases. Phase A (Tasks 1-8) fixes security and accessibility defects with surgical edits to existing files — no new files, no new dependencies. Phase B (Tasks 9-14) removes dead weight and installs the first automated guardrails (`tsconfig.json`, Vitest, CI gates), which requires deleting unused code *before* type-checking so the gate doesn't fail on files being removed. Phase C (Tasks 15-20) does content work and the three refactors, each landing only after tests exist to catch regressions.

**Tech Stack:** Vite 6.3.5 (pinned), React 18.3.1, TypeScript (transpile-only today), Tailwind CSS 4.1.12 (CSS-first, no config file), Radix/shadcn primitives, `motion` 12, PDF.js 4.10.38, Three.js r128 (vendored by Task 2), Vitest (added by Task 11), pnpm 10+.

**Spec:** This document. §Findings Index below is the authoritative list of what must be fixed; it is transcribed from the 2026-09-07 review. Each task cites the finding IDs it closes.

## Global Constraints

- Package manager is **pnpm, pinned to 10.17.1** — invoke every command as `npx pnpm@10.17.1 <cmd>`. **Do not use `npx pnpm@latest`.** It resolves to pnpm 12, which rewrites `pnpm-lock.yaml` and **silently deletes the top-level `overrides:` block** that pins vite and aliases rollup to the WASM build. CI uses 10.17.1 (`.github/workflows/pages.yml`), so `@latest` also desynchronizes the lockfile from CI. On macOS npm-cache permission errors: `env npm_config_cache=/private/tmp/npm-cache npx pnpm@10.17.1 install`.
- **After any command that touches `pnpm-lock.yaml`** (`install`, `add`, `remove`), verify the pin survived:
  ```bash
  grep -A3 "^overrides:" pnpm-lock.yaml
  ```
  Expected: `vite: 6.3.5` and `rollup: npm:@rollup/wasm-node@4.60.2`. If the block is gone, `git checkout -- pnpm-lock.yaml` and redo the operation with the pinned pnpm version. A lockfile without this block breaks the build on a clean install.
- Every `npx pnpm@latest <cmd>` written in the task steps below means `npx pnpm@10.17.1 <cmd>`. The constraint here overrides the literal text in any step.
- **Do not bump `vite` off `6.3.5`** and **do not unpin the `rollup` → `@rollup/wasm-node@4.60.2` alias** in `package.json` `pnpm.overrides`. The build depends on this workaround, reinforced by the `postinstall` script `tools/patch-rollup-native.mjs`.
- There is **no `tailwind.config.*`** — Tailwind 4 is configured CSS-first. Theme tokens live in `src/app/src/styles/default_theme.css` (`@theme inline`) and `src/app/src/styles/globals.css` (`:root` + `.dark` semantic tokens).
- The real application lives at **`src/app/src/app/`**, not `src/`. Entry chain: `index.html` → `src/main.tsx` → `src/app/src/app/App.tsx`. `@` aliases to `./src`.
- **`src/styles/` (repo root) is a stale duplicate and is not imported.** Edit `src/app/src/styles/` only. Task 13 deletes the stale copies.
- **CircuitTrace coupling (critical):** `src/app/src/app/components/CircuitTrace.tsx` measures the rendered geometry of the six `[data-section]` elements at runtime and drops IC blocks into the inter-section gaps. A gap is only usable when `gap.bottom - gap.top >= 70` px, and the buck block needs horizontal room `avail >= 340` px. **No task in this plan may change `space-y-16 lg:space-y-24` on the section wrapper (`Layout.tsx:212`), remove or merge any of the six `[data-section]` blocks, make `<main>` narrower than full width, or remove the `lg:pl-12 lg:pr-12` gutter corridors (`Layout.tsx:275`).** Breaking this is silent — the ICs just stop rendering.
- **Content lives in `src/app/src/app/data/portfolio.ts`**, not in components. Content changes go there.
- **No em-dashes (`—`) in prose description fields** in `portfolio.ts` (`description`, `about`, `summary`, `overview`, build descriptions). Em-dashes in `period`, `company`, and `coursework` label fields are existing, accepted formatting and must be left alone.
- **Verification before Task 11:** there is no test runner until Task 11 installs one. Tasks 1-10 verify with `npx pnpm@latest build` (must exit 0), targeted `grep` assertions given per task, and the manual browser checks written into each task. From Task 11 onward, `npx pnpm@latest exec vitest run` is also available.
- **Commit after every task.** Conventional Commits format, normal English (not caveman). Do not push; do not open PRs unless asked.
- Dark theme is the design target (`#10141c` / `#ff6b35`); the light theme is secondary but is shipped and reachable from the toggle, so it must also pass contrast.

---

## Findings Index

Every finding this plan must close, with the task that closes it.

| ID | Severity | Finding | Task |
|----|----------|---------|------|
| H1 | High | CDN `<script>` (three.js r128, chevrotain, VRMLLoader) with no SRI inside site origin | 2 |
| H2 | High | Primary button text fails AA contrast: 3.46:1 light, 2.84:1 dark | 5 |
| H3 | High | Six `<h1>` elements on one page; broken heading outline | 3 |
| H4 | High | No skip link (WCAG 2.4.1 Level A) | 4 |
| H5 | High | Nested interactive controls inside `role="button"` project card | 6 |
| H6 | High | `robots.txt` and `profile.liveSite` point at wrong domain (`cameronlewis.dev`) | 1 |
| M1 | Medium | 43 unused `components/ui/*` files, ~30 orphaned dependencies | 9 |
| M2 | Medium | `ResumeViewer` PDF load has no `.catch`; failure hangs skeleton forever | 7 |
| M3 | Medium | `?skeleton=` debug flag ships to production, branched on in 4 components | 8 |
| M4 | Medium | `--text-muted` 2.67:1 and `--text-soft` ~4.0:1 in light theme | 5 |
| M5 | Medium | No `aria-current` on sidebar nav; mobile nav has no `<nav>` landmark | 4 |
| M6 | Medium | `board-viewer-shell.html` resolves attacker-suppliable absolute `model` URL | 2 |
| M7 | Medium | Headshot 320 KB, rendered twice, eager, no dimensions; 12 oversized PNGs | 12 |
| M8 | Medium | No `tsconfig.json`, no lint, no tests; CI gates nothing | 10, 11 |
| L1 | Low | Three stale duplicate stylesheets tracked in git | 13 |
| L2 | Low | `CLAUDE.md` stale: claims `node-local` is tracked (it is gitignored) | 13 |
| L3 | Low | `README.md` stale: nonexistent contact form, wrong styles path, wrong geometry path | 13 |
| L4 | Low | `sitemap.xml` has no `lastmod` | 1 |
| L5 | Low | `theme-color` is dark-only and matches neither theme's background | 1 |
| L6 | Low | `CircuitTrace.tsx` is 2815 lines with no testable seam | 18 |
| L7 | Low | `rel="noreferrer"` without `noopener` (6 sites) | 14 |
| L8 | Low | Deprecated `escape()` in `board-assets.ts:31` | 14 |
| L9 | Low | Confirm em-dash convention compliance in `portfolio.ts` | 15 |
| L10 | Low | Hand-counted project stat will drift from `projects.length` | 1 |
| L11 | Low | Orphaned `scripts/ui/pdf-viewer.js` loads a cdnjs PDF.js worker; nothing references it (found during Task 2 review) | 14 |
| P21 | Content | Hero undersells; 3D viewer buried | 15 |
| P22 | Content | Impact evidence thin relative to process detail | 20 |
| P23 | Refactor | Extract `useHashRoute()` from `Layout.tsx` | 16 |
| P24 | Refactor | Extract modal-stack reducer from `Layout.tsx` | 17 |
| P26 | UX | No progress indication for the 4 MB geometry fetch | 19 |

---

## File Structure

Files created or modified across the plan, and what each is responsible for.

**Created:**
- `tsconfig.json` (root) — TypeScript config so `tsc --noEmit` can run. Task 10.
- `vitest.config.ts` (root) — Vitest config, aliases matching `vite.config.ts`. Task 11.
- `src/app/src/app/lib/routing.ts` — `parseHash`, `SECTION_IDS`, `isSectionId`, extracted from `Layout.tsx` so they are importable and testable. Task 11.
- `src/app/src/app/hooks/useHashRoute.ts` — hash-routing side effects extracted from `Layout.tsx`. Task 16.
- `src/app/src/app/hooks/useModalStack.ts` — modal open/close/return-to-project reducer. Task 17.
- `src/app/src/app/lib/circuit-geometry.ts` — pure section-gap → IC-placement math extracted from `CircuitTrace.tsx`. Task 18.
- `tests/routing.test.ts` — `parseHash` route coverage. Task 11.
- `tests/portfolio-data.test.ts` — content integrity: org references, asset paths, `updateFeed` ordering. Task 11.
- `tests/circuit-geometry.test.ts` — IC placement threshold behavior. Task 18.
- `public/portfolio/assets/viewers/vendor/three.min.js` — vendored Three.js r128. Task 2.

**Modified (primary responsibility of each change):**
- `public/robots.txt`, `public/sitemap.xml`, `index.html` — site metadata correctness. Task 1.
- `src/app/src/app/data/portfolio.ts` — content source of truth; domain fix, derived stat, hero copy. Tasks 1, 15, 20.
- `public/portfolio/assets/viewers/board-viewer-shell.html` — viewer trust boundary and script sourcing. Tasks 2, 19.
- `src/app/src/app/components/SectionHeader.tsx` + 8 section/modal components — heading levels. Task 3.
- `src/app/src/app/components/Layout.tsx` — app shell; skip link, then two extractions. Tasks 4, 16, 17.
- `src/app/src/app/components/Sidebar.tsx` — nav semantics. Task 4.
- `src/app/src/styles/globals.css` — theme tokens; contrast fixes, `sr-only` utility. Tasks 4, 5.
- `src/app/src/app/components/Projects.tsx` — card interaction model. Task 6.
- `src/app/src/app/components/ResumeViewer.tsx` — PDF error state. Task 7.
- `src/app/src/app/components/Skeletons.tsx` — dev-only gating of the debug flag. Task 8.
- `package.json` — dependency pruning, then test scripts. Tasks 2, 9, 10, 11.
- `.github/workflows/pages.yml` — CI gates. Tasks 10, 11.
- `src/app/src/app/components/Home.tsx` — headshot markup, hero copy. Tasks 12, 15.
- `README.md`, `CLAUDE.md` — documentation accuracy. Task 13.
- `src/app/src/app/lib/board-assets.ts` — modern text decoding. Task 14.
- `src/app/src/app/components/BoardViewer.tsx` — progress messaging. Task 19.

**Deleted:**
- 43 files under `src/app/src/app/components/ui/`. Task 9.
- `src/styles/default_theme.css`, `src/styles/index.css`, `src/app/default_shadcn_theme.css`, `default_shadcn_theme.css` (root). Task 13.

---

## Phase A — Stabilize (Tasks 1-8)

### Task 1: Site metadata and derived-content corrections

Closes: **H6, L4, L5, L10**

**Files:**
- Modify: `public/robots.txt:4`
- Modify: `public/sitemap.xml`
- Modify: `index.html:9`
- Modify: `src/app/src/app/data/portfolio.ts:180` and `:192`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. `stats` keeps its existing exported type `StatRecord[]`; only the `value` of the "Projects" entry changes from a literal to a derived expression.

- [ ] **Step 1: Fix the sitemap domain in robots.txt**

`public/robots.txt` currently reads:

```
User-agent: *
Allow: /

Sitemap: https://cameronlewis.dev/sitemap.xml
```

Replace the whole file with:

```
User-agent: *
Allow: /

Sitemap: https://cameron-lewis.com/sitemap.xml
```

The old domain does not host this site — `public/CNAME` and the `index.html` canonical both use `cameron-lewis.com`.

- [ ] **Step 2: Add lastmod to the sitemap**

Replace `public/sitemap.xml` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cameron-lewis.com/</loc>
    <lastmod>2026-09-07</lastmod>
  </url>
</urlset>
```

One URL is correct here — the site's other routes are hash fragments (`#/projects/<slug>`), which search engines do not index as separate documents.

- [ ] **Step 3: Fix the liveSite domain in portfolio.ts**

In `src/app/src/app/data/portfolio.ts`, inside `export const profile: ProfileRecord = {`, change:

```ts
  liveSite: "https://cameronlewis.dev",
```

to:

```ts
  liveSite: "https://cameron-lewis.com",
```

- [ ] **Step 4: Derive the project count instead of hand-counting it**

In `portfolio.ts`, `stats` is declared *before* `projects`. A `const` array cannot be referenced before its initializer runs, so moving the `stats` declaration is required. Cut the entire `export const stats: StatRecord[] = [...]` block (currently at `:190-195`) and re-paste it immediately after the `export const projects: ProjectRecord[] = [...]` block ends (currently around `:493`), changing the Projects entry:

```ts
export const stats: StatRecord[] = [
  { label: "GPA", value: "3.8", detail: "out of 4.0" },
  { label: "Projects", value: String(projects.length), detail: "documented builds" },
  { label: "Experience", value: "2", detail: "engineering roles" },
  { label: "Grad Date", value: "2029", detail: "expected B.Eng" },
];
```

Everything importing `stats` (only `Home.tsx`) uses the module's exports, so declaration order inside the file does not affect consumers.

- [ ] **Step 5: Add a light-theme companion for theme-color**

In `index.html`, replace the single line:

```html
    <meta name="theme-color" content="#0c0c14" />
```

with a matched pair whose values are the actual `--background` tokens from `globals.css`:

```html
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f1ea" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#10141c" />
```

- [ ] **Step 6: Verify**

Run:

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
grep -c "cameronlewis.dev" public/robots.txt src/app/src/app/data/portfolio.ts
```

Expected: `0` for both files (grep exits 1 with two `0` counts — that is the pass condition).

Run:

```bash
npx pnpm@latest build
```

Expected: exit code 0.

Run `npx pnpm@latest dev`, open the page, and confirm the Home stats row still shows four tiles and the Projects tile reads the true number of entries in `projects` (count them in `portfolio.ts` to confirm the derived value matches).

- [ ] **Step 7: Commit**

```bash
git add public/robots.txt public/sitemap.xml index.html src/app/src/app/data/portfolio.ts
git commit -m "fix: correct site domain in robots and profile, derive project count

The sitemap directive and profile.liveSite both pointed at cameronlewis.dev,
which does not host this site. Also adds sitemap lastmod, a light-theme
theme-color, and derives the project stat from projects.length so it cannot
drift from the data."
```

---

### Task 2: Vendor Three.js, delete the WRL path, constrain the model parameter

Closes: **H1, M6**

**Files:**
- Create: `public/portfolio/assets/viewers/vendor/three.min.js`
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html:115`, `:127-128`, `:301-317`, `:435-436`
- Modify: `src/app/src/app/components/BoardViewer.tsx:31`
- Modify: `package.json` (remove `three`)
- Modify: `ATTRIBUTIONS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the viewer shell continues to accept `?mode=bundle&asset=power|control|brick`. The `mode=wrl`, `model`, and `title` query parameters are **removed** — no later task may reference them.

- [ ] **Step 1: Vendor the Three.js build**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
mkdir -p public/portfolio/assets/viewers/vendor
curl -fsSL https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js \
  -o public/portfolio/assets/viewers/vendor/three.min.js
ls -la public/portfolio/assets/viewers/vendor/three.min.js
```

Expected: a file around 600 KB. If the download fails, get the same r128 build from `https://unpkg.com/three@0.128.0/build/three.min.js` — the viewer code targets the r128 API and must not be silently upgraded in this task.

- [ ] **Step 2: Point the shell at the vendored copy**

In `public/portfolio/assets/viewers/board-viewer-shell.html`, replace line 115:

```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

with:

```html
    <script src="/portfolio/assets/viewers/vendor/three.min.js"></script>
```

Delete the four-line HTML comment immediately below it (the one beginning `chevrotain + VRMLLoader are only needed for mode=wrl`) — Step 4 removes what it describes.

- [ ] **Step 3: Remove the model and title parameters**

In the same file, inside the IIFE, replace:

```js
        const mode = params.get("mode") === "wrl" ? "wrl" : "bundle";
        const assetParam = params.get("asset");
        const asset = assetParam === "control" || assetParam === "brick" ? assetParam : "power";
        const modelParam = params.get("model");
        const modelUrl = modelParam ? new URL(modelParam, window.location.origin).toString() : null;
```

with:

```js
        const assetParam = params.get("asset");
        const asset = assetParam === "control" || assetParam === "brick" ? assetParam : "power";
```

`new URL(modelParam, origin)` let a fully-qualified `?model=https://...` override the origin base, making the page a fetch initiator on this origin for arbitrary URLs. Dropping the parameter removes the capability rather than trying to filter it. The `title` parameter is set by the app but never read by the shell, so nothing reads it after this change either.

- [ ] **Step 4: Delete the WRL code path**

Still in `board-viewer-shell.html`:

1. Delete the `loadScript` function in its entirety, including its two-line comment (currently `:301-317`, beginning `// Loads a script tag on demand`).
2. Find the `if (mode === "wrl")` branch that contains:
   ```js
   await loadScript("https://cdn.jsdelivr.net/npm/chevrotain@10.4.1/lib/chevrotain.min.js");
   await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/VRMLLoader.js");
   ```
   Delete the whole branch, keeping only the `bundle` path that calls `fetchBoardGeometry(asset)`. The code comment at `:302` already states no current board uses the WRL path.
3. Remove any now-unreferenced `mode` variable usages the deletion leaves behind.

Read the surrounding function before cutting — the branch is inside an `async` initializer, and the `bundle` path must remain awaited exactly as it is today.

- [ ] **Step 5: Stop sending the dead parameters from the app**

In `src/app/src/app/components/BoardViewer.tsx`, replace the `viewerSrc` memo body:

```ts
    const url = new URL("/portfolio/assets/viewers/board-viewer-shell.html", window.location.origin);
    url.searchParams.set("mode", project.viewerMode === "wrl" ? "wrl" : "bundle");
    if (project.viewerMode === "wrl" && project.viewerModelUrl) {
      url.searchParams.set("model", project.viewerModelUrl);
    } else {
      url.searchParams.set("asset", project.viewerAsset ?? "power");
    }
    url.searchParams.set("title", project.title);
    return url.toString();
```

with:

```ts
    const url = new URL("/portfolio/assets/viewers/board-viewer-shell.html", window.location.origin);
    url.searchParams.set("asset", project.viewerAsset ?? "power");
    return url.toString();
```

Leave the `ProjectRecord` fields `viewerMode` and `viewerModelUrl` in `portfolio.ts` alone for now — Task 10's type check will report them as unused only if they become unreferenced, and removing data fields is a separate concern from removing the code path.

- [ ] **Step 6: Move `three` from dependencies to devDependencies**

`three@0.174.0` is in `package.json` `dependencies` but is imported by zero files under `src/` — the viewer used the CDN copy. It is **not** unused overall: `tools/build-brick-geometry.mjs:4-6` and `tools/debug-vrml.mjs:3` import it, so deleting it would break `pnpm build:geometry` and the `rebuild-board-geometry` workflow.

Move the line out of `dependencies` and into `devDependencies`, keeping the version:

```json
  "devDependencies": {
    "@rollup/wasm-node": "4.60.2",
    "@tailwindcss/vite": "4.1.12",
    "@vitejs/plugin-react": "4.7.0",
    "lightningcss-darwin-arm64": "1.30.1",
    "tailwindcss": "4.1.12",
    "three": "0.174.0",
    "vite": "6.3.5"
  }
```

Then:

```bash
npx pnpm@10.17.1 install
grep -A3 "^overrides:" pnpm-lock.yaml
```

Expected: the `overrides:` block still lists `vite: 6.3.5` and `rollup: npm:@rollup/wasm-node@4.60.2`. If it vanished, you used the wrong pnpm version — `git checkout -- pnpm-lock.yaml` and redo with 10.17.1.

Confirm the tooling still resolves:

```bash
node --input-type=module -e "import('three').then(() => console.log('three resolves'))"
```

Expected: `three resolves`.

- [ ] **Step 7: Record the vendored attribution**

Append to `ATTRIBUTIONS.md`:

```markdown
- Three.js r128 (MIT) — vendored at `public/portfolio/assets/viewers/vendor/three.min.js`
  for the 3D board viewer. Source: https://github.com/mrdoob/three.js
```

- [ ] **Step 8: Verify**

Run:

```bash
grep -c "https://" public/portfolio/assets/viewers/board-viewer-shell.html
```

Expected: `0`.

Run:

```bash
grep -rn "cdnjs\|jsdelivr\|unpkg" public/ src/ --include='*.html' --include='*.ts' --include='*.tsx'
```

Expected: no output.

Run `npx pnpm@latest build` (expected: exit 0), then `npx pnpm@latest preview`. Open each of the three boards (Aux Power, Aux Control, Brick Buck) from the project modals. For each one confirm: the board renders, Reset / Top View / Wireframe all respond, the skeleton clears (which proves the `viewer-ready` postMessage handshake still fires), and the browser console shows no errors and no requests to any third-party host in the Network tab.

- [ ] **Step 9: Commit**

```bash
git add public/portfolio/assets/viewers/vendor/three.min.js \
        public/portfolio/assets/viewers/board-viewer-shell.html \
        src/app/src/app/components/BoardViewer.tsx \
        package.json pnpm-lock.yaml ATTRIBUTIONS.md
git commit -m "fix(security): vendor three.js and remove all CDN script loads

The board viewer executed three scripts from cdnjs and jsdelivr with no
subresource integrity, in the site's own origin. Vendors the r128 build
locally and deletes the unused WRL path along with its two jsdelivr loads.
Also drops the model query parameter, which resolved absolute URLs and made
the shell a fetch initiator for arbitrary hosts, and removes the unused
three dependency."
```

---

### Task 3: Fix the document heading hierarchy

Closes: **H3**

**Files:**
- Modify: `src/app/src/app/components/SectionHeader.tsx:47`
- Modify: `src/app/src/app/components/Experience.tsx:79`
- Modify: `src/app/src/app/components/Education.tsx:156`
- Modify: `src/app/src/app/components/Projects.tsx:194`
- Modify: `src/app/src/app/components/Skills.tsx:158`, `:176`
- Modify: `src/app/src/app/components/Updates.tsx:46`
- Modify: `src/app/src/app/components/OrganizationContextModal.tsx:51`, `:79`, `:89`, `:104`
- Modify: `src/app/src/app/components/ProjectModal.tsx:208`, `:256`, `:263`, `:270`

**Interfaces:**
- Consumes: nothing.
- Produces: `SectionHeader` renders `<h2>` instead of `<h1>`. Its props are unchanged (`index?`, `kicker`, `title`, `intro?`, `action?`).

**Target outline.** `Home.tsx:126` (the profile name) is the page's only `<h1>`. Section titles are `<h2>`. Cards and sub-blocks inside a section are `<h3>`. Modals are separate contexts: Radix `DialogTitle` renders an `<h2>`, so headings inside modal bodies are `<h3>`, and blocks nested inside those are `<h4>`.

- [ ] **Step 1: Demote the shared section header**

In `SectionHeader.tsx`, change the element at `:47` from `h1` to `h2`, keeping every class verbatim:

```tsx
        <h2 className="mt-3.5 font-display text-[2rem] font-semibold tracking-[-0.02em] text-[var(--text-strong)] sm:text-[2.55rem]">
          {title}
        </h2>
```

All styling is class-driven, so the rendered appearance is byte-identical.

- [ ] **Step 2: Demote the headings now nested under a section h2**

Each of these is currently an `<h2>` sitting inside a section whose header just became an `<h2>`. Change the opening and closing tags to `h3`, leaving all classes and children untouched:

- `Experience.tsx:79` — `{entry.role}` → `h3`
- `Education.tsx:156` → `h3`
- `Projects.tsx:194` — `{project.title}` → `h3`
- `Skills.tsx:158` — `{item.title}` → `h3`
- `Updates.tsx:46` → `h3`

**Do not change `Home.tsx:182`** ("Who I am"). The Home section has no `SectionHeader` — its `<h1>` at `:126` is the page title, and the About card heading is a peer of the other sections' `<h2>` titles, so `h2` is already correct there.

For `Skills.tsx:176` ("Soft Skills") the tag is already `h3`. If it is a sibling of the `Skills.tsx:158` cards rather than nested inside one, leave it; if it heads its own block at the same level as the card grid, it stays `h3`. Read the surrounding JSX and match the visual nesting.

- [ ] **Step 3: Fix the modal heading levels**

`OrganizationContextModal.tsx` and `ProjectModal.tsx` render inside a Radix `Dialog`. If the component renders a `DialogTitle`, that is the modal's `<h2>` and body headings start at `<h3>`. If it does not, the topmost heading in the modal body should become `<h2>`.

- `OrganizationContextModal.tsx:51` — the org name, currently `h2`: keep as `h2` if there is no `DialogTitle`; demote to `h3` if there is.
- `OrganizationContextModal.tsx:79` ("Overview"), `:89` ("What I Built") — currently `h3`, keep.
- `OrganizationContextModal.tsx:104` — currently `h4` nested under `:89`, keep.
- `ProjectModal.tsx:208`, `:256`, `:263`, `:270` — currently `h3`. `ProjectModal` renders a `DialogTitle`, so `h3` is already correct. Verify by grepping for `DialogTitle` in the file before changing anything.

```bash
grep -n "DialogTitle" src/app/src/app/components/ProjectModal.tsx src/app/src/app/components/OrganizationContextModal.tsx
```

- [ ] **Step 4: Verify**

Run `npx pnpm@latest build` (expected: exit 0), then `npx pnpm@latest dev`.

In the browser console on the portfolio view, run:

```js
document.querySelectorAll("h1").length
```

Expected: `1`.

Then check the outline has no skipped levels:

```js
[...document.querySelectorAll("h1,h2,h3,h4")].map(h => h.tagName + " " + h.textContent.trim().slice(0, 40))
```

Expected: starts with one `H1`, then `H2`s for section titles, `H3`s nested beneath them, no jump from `H2` straight to `H4`.

Install the axe DevTools browser extension and run a scan on the portfolio view and on each modal (project, organization, resume, board viewer, BOM). Expected: zero `heading-order` and zero `page-has-heading-one` violations.

Visually compare each section against the pre-change appearance — nothing should move or resize.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/components/
git commit -m "fix(a11y): correct document heading hierarchy

SectionHeader rendered an h1, so every section title was a top-level
heading and the page had six h1 elements. Demotes section titles to h2 and
cascades card headings to h3, leaving the profile name as the only h1.
All styling is class-driven, so the rendering is unchanged."
```

---

### Task 4: Add a skip link, nav landmark, and aria-current

Closes: **H4, M5**

**Files:**
- Modify: `src/app/src/styles/globals.css` (append utility)
- Modify: `src/app/src/app/components/Layout.tsx` (skip link + `<main>` target)
- Modify: `src/app/src/app/components/Sidebar.tsx:80`, `:168`, `:183`

**Interfaces:**
- Consumes: nothing.
- Produces: the `<main>` element gains `id="main-content"`. No other task may change that id.

- [ ] **Step 1: Add the sr-only utility**

`grep -n "sr-only" src/app/src/styles/globals.css` returns nothing — Tailwind 4 ships `sr-only` as a built-in utility, but the focus-reveal variant needs an explicit pair. Append to `src/app/src/styles/globals.css`:

```css
/* Skip link: visually hidden until it receives keyboard focus, then it lands
   as a real button in the top-left corner. WCAG 2.4.1 (Bypass Blocks). */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 200;
}

.skip-link:focus {
  left: 1rem;
  top: 1rem;
  display: inline-flex;
  align-items: center;
  border-radius: 0.75rem;
  border: 1px solid var(--outline-strong);
  background: var(--surface-1);
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-strong);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 2: Render the skip link as the first focusable element**

In `Layout.tsx`, inside the outermost returned `<div className="min-h-screen bg-background text-foreground">`, add the link as the very first child — before the decorative blob container:

```tsx
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
```

- [ ] **Step 3: Make `<main>` a focus target**

In `Layout.tsx`, on the `<main>` element, add `id` and `tabIndex` while leaving every existing attribute and class exactly as it is:

```tsx
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2"
        >
```

`tabIndex={-1}` makes the element programmatically focusable so the browser moves focus there (not just scroll position) when the skip link is activated. Do not change the class string — `lg:h-[calc(100vh-2rem)]` and the full-width flex behavior are load-bearing for CircuitTrace.

- [ ] **Step 4: Add aria-current to the sidebar nav buttons**

In `Sidebar.tsx`, the nav item button currently reads:

```tsx
        <button
          type="button"
          onClick={() => {
            onSelect(item.id);
            setIsOpen(true);
          }}
          aria-label={item.label}
```

Add `aria-current` immediately after `aria-label`:

```tsx
          aria-label={item.label}
          aria-current={active ? "true" : undefined}
```

`active` is already computed at the top of the render function (`const active = item.id === activeItem;`). Without this, the active section is announced identically to every other item — the state is conveyed only by color and a decorative dot.

- [ ] **Step 5: Give the mobile nav a landmark and aria-current**

In `Sidebar.tsx`, the mobile section-chip row is a bare `<div className="mt-4 flex gap-2 overflow-x-auto pb-1">`. Change it to a `<nav>` with a label:

```tsx
          <nav aria-label="Sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
```

and close it with `</nav>`. Inside its `.map`, add `aria-current` to the chip button, which already computes `active`:

```tsx
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(item.id)}
```

The desktop `<nav>` already exists further down the file — do not add a second label to it without checking; if it has no `aria-label`, give it `aria-label="Sections"` too, and confirm the two are never rendered simultaneously (one is `lg:hidden`, the other `hidden lg:block`, so they are not).

- [ ] **Step 6: Verify**

Run `npx pnpm@latest build` (expected: exit 0), then `npx pnpm@latest dev`.

Keyboard test at 1440px width: load the page, press Tab once. Expected: a visible "Skip to content" button appears in the top-left. Press Enter. Expected: focus moves into `<main>` — confirm with `document.activeElement.id` in the console, which should print `main-content`.

Repeat at 375px width. Expected: the same behavior, and Tab no longer walks through seven nav chips before reaching content.

Run axe DevTools. Expected: zero violations for `bypass`, `landmark-unique`, and `region`; a `navigation` landmark is reported at both breakpoints.

With a screen reader (VoiceOver: Cmd+F5), navigate the sidebar. Expected: the active section is announced as "current".

- [ ] **Step 7: Commit**

```bash
git add src/app/src/styles/globals.css \
        src/app/src/app/components/Layout.tsx \
        src/app/src/app/components/Sidebar.tsx
git commit -m "feat(a11y): add skip link, mobile nav landmark, and aria-current

The page had no bypass mechanism (WCAG 2.4.1 Level A), so keyboard users on
mobile tabbed through seven nav chips before every section. Adds a
focus-revealed skip link targeting main, wraps the mobile chip row in a
labelled nav, and marks the active nav item with aria-current so its state
is not conveyed by color alone."
```

---

### Task 5: Fix WCAG AA contrast failures

Closes: **H2, M4**

**Files:**
- Modify: `src/app/src/styles/globals.css` — light `:root` block (`--primary`, `--primary-foreground`, `--text-soft`, `--text-muted`, `--sidebar-primary-foreground`) and `.dark` block (`--primary-foreground`, `--sidebar-primary-foreground`)

**Interfaces:**
- Consumes: nothing.
- Produces: token values only. No component changes; every consumer reads these through `var(--primary)` / `text-primary-foreground`.

**The measurements.** Computed from the current hex values using the WCAG relative-luminance formula:

| Pair | Current | Required | Status |
|------|---------|----------|--------|
| `#ffffff` on `--primary #e85d2a` (light) | 3.46:1 | 4.5:1 | fail |
| `#ffffff` on `--primary #ff6b35` (dark) | 2.84:1 | 4.5:1 | fail |
| `--text-muted #9c9488` on `#f4f1ea` (light) | 2.67:1 | 4.5:1 | fail |
| `--text-soft #7d766b` on `#f4f1ea` (light) | ~4.0:1 | 4.5:1 | fail |
| `--text-muted #7e88a0` on `#10141c` (dark) | ~5.2:1 | 4.5:1 | pass |

Primary buttons use `text-sm font-semibold` (14px), which is below the large-text threshold (18.66px bold / 24px regular), so 4.5:1 applies.

- [ ] **Step 1: Switch the on-primary foreground to near-black**

The brand orange is the point of the palette, so darkening it is the wrong trade. Instead invert the foreground. In the light `:root` block of `globals.css`, change:

```css
  --primary-foreground: #ffffff;
```

to:

```css
  --primary-foreground: #1a0d05;
```

Do the same in the `.dark` block. Also update `--sidebar-primary-foreground` in both blocks — it is `#ffffff` and pairs with `--sidebar-primary`, which is the same orange.

Resulting ratios: `#1a0d05` on `#e85d2a` ≈ 6.9:1 (light), `#1a0d05` on `#ff6b35` ≈ 8.4:1 (dark). Both clear AA with margin.

- [ ] **Step 2: Darken the light-theme muted and soft text**

In the light `:root` block only (the `.dark` values already pass), change:

```css
  --text-soft: #7d766b;
  --text-muted: #9c9488;
```

to:

```css
  --text-soft: #6a6358;
  --text-muted: #6f685c;
```

`#6a6358` on `#f4f1ea` ≈ 5.4:1; `#6f685c` ≈ 5.0:1. Both pass. `--text-muted` staying slightly lighter than `--text-soft` preserves the intended hierarchy while both clear the threshold.

- [ ] **Step 3: Check the tokens that derive from these**

```bash
grep -n "text-soft\|text-muted\|primary-foreground" src/app/src/styles/globals.css
```

`--text-soft` feeds three `color-mix()` expressions (scrollbar thumb, `scrollbar-color`, and a skeleton background). Darkening the source darkens those proportionally — check the scrollbar and skeleton visually in Step 5 and nudge the mix percentages if either reads too heavy.

- [ ] **Step 4: Verify the arithmetic before trusting the eye**

For each changed pair, confirm with a contrast checker (WebAIM Contrast Checker, or axe DevTools' color-contrast rule). Do not approve these by eye — the failures being fixed were invisible to the eye in the first place.

- [ ] **Step 5: Verify in the browser**

Run `npx pnpm@latest build` (expected: exit 0), then `npx pnpm@latest dev`.

In **both** themes (toggle with the sidebar control), run axe DevTools on all six sections and each modal. Expected: zero `color-contrast` violations.

Visually check: the "View Projects" CTA on Home, the primary chips, the stat detail lines, the sidebar headline on mobile, the `SectionHeader` kicker chip, and the skeleton loaders (`?skeleton=1`). The orange stays orange; only the text on top of it changes.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/styles/globals.css
git commit -m "fix(a11y): meet AA contrast on primary buttons and light-theme text

White on the brand orange measured 3.46:1 (light) and 2.84:1 (dark) at 14px
semibold, against a 4.5:1 requirement. Switches the on-primary foreground to
near-black, which preserves the orange and clears AA with margin, and darkens
the light theme's muted and soft text from 2.67:1 and 4.0:1 to above 5:1."
```

---

### Task 6: Un-nest the interactive controls in project cards

Closes: **H5**

**Files:**
- Modify: `src/app/src/app/components/Projects.tsx:86-99` (card container), `:194` (title), `:206-220` (footer)

**Interfaces:**
- Consumes: `onOpenProject(project)` and `onOpenOrganization(project)` props, unchanged.
- Produces: nothing new.

**The problem.** The card is a `div role="button" tabIndex={0}` with Enter/Space handling, and it contains two real `<button>` elements ("Open context" at `:206` and the org header button at `:166`). Nested interactive elements inside a button role is invalid ARIA: assistive tech announces the card as a single control and the inner buttons become ambiguous or unreachable. The inner buttons currently paper over the click-bubbling half of this with `event.stopPropagation()`, which is the tell.

**The fix.** The stretched-link pattern: the card becomes a plain container, the project title becomes the real button, and a pseudo-element on that button covers the card so the whole surface stays clickable. Inner buttons sit above it with `relative z-10`.

- [ ] **Step 1: Make the card container non-interactive**

Replace the opening of the card container:

```tsx
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenProject(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenProject(project);
                  }
                }}
                onMouseMove={project.viewer3d ? tiltCard : undefined}
                onMouseLeave={project.viewer3d ? resetTilt : undefined}
                className="group relative flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-left shadow-[var(--shadow-card)] outline-none transition-transform duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-ring/25"
              >
```

with:

```tsx
              <div
                onMouseMove={project.viewer3d ? tiltCard : undefined}
                onMouseLeave={project.viewer3d ? resetTilt : undefined}
                className="group relative flex h-full min-h-[29rem] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--outline-soft)] bg-[var(--surface-1)] text-left shadow-[var(--shadow-card)] transition-transform duration-200 ease-out will-change-transform focus-within:ring-2 focus-within:ring-ring/25"
              >
```

Changes: `role`, `tabIndex`, `onClick`, and `onKeyDown` are gone; `outline-none` is dropped (it was suppressing the focus ring on the element that no longer takes focus); `focus-visible:ring-*` becomes `focus-within:ring-*` so the card still shows a ring when the title button inside it is focused.

- [ ] **Step 2: Make the title the real control with a stretched hit area**

Replace the title heading (which Task 3 changed to `h3`):

```tsx
                    <h3 className="font-display text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{project.title}</h3>
```

with:

```tsx
                    <h3 className="font-display text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">
                      <button
                        type="button"
                        onClick={() => onOpenProject(project)}
                        className="text-left outline-none after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                      >
                        {project.title}
                      </button>
                    </h3>
```

The `after:absolute after:inset-0` pseudo-element covers the whole card (the container is already `relative`), so clicking anywhere still opens the project — but there is exactly one control doing it, and it carries the project title as its accessible name. Keyboard activation now comes from the native `<button>`, so the hand-rolled Enter/Space handler is no longer needed.

- [ ] **Step 3: Lift the inner buttons above the stretched area**

The org header button (`:166`) and the "Open context" button (`:206`) must sit above the `after` overlay. Add `relative z-10` to both class strings, and delete the now-unnecessary `event.stopPropagation()` from both handlers since there is no ancestor click handler left to stop:

Org header button:

```tsx
                      <button
                        type="button"
                        onClick={() => onOpenOrganization(project)}
                        className="relative z-10 flex min-w-0 items-center gap-3 text-left"
                      >
```

"Open context" button:

```tsx
                      <button
                        type="button"
                        onClick={() => onOpenOrganization(project)}
                        className="relative z-10 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                      >
```

- [ ] **Step 4: Neutralize the decorative "Open project" affordance**

The footer's `<div className="inline-flex items-center gap-2 ...">` containing "Open project" is not a control and never was — it is a visual affordance. It now sits under the stretched overlay, which is correct. Add `aria-hidden="true"` so it is not announced as duplicate text alongside the title button:

```tsx
                    <div aria-hidden="true" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
```

- [ ] **Step 5: Verify**

Run `npx pnpm@latest build` (expected: exit 0), then `npx pnpm@latest dev`.

Mouse test: click the card background — the project modal opens. Click the org avatar/name block — the organization modal opens, not the project modal. Click "Open context" — the organization modal opens. This last pair is the regression that would prove the `z-10` lift failed.

Keyboard test: Tab through the projects grid. Expected order per card — title button, org header button (if present), "Open context" button (if present). Enter on the title opens the project. The card shows a focus ring while any of its controls is focused.

Screen reader: each card announces the project title as a button, not the entire card's text as one control.

Run axe DevTools on the Projects section. Expected: zero `nested-interactive` and zero `aria-required-children` violations.

Also confirm the hover tilt still works on cards with `viewer3d` — `onMouseMove`/`onMouseLeave` moved but stayed on the same element.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/components/Projects.tsx
git commit -m "fix(a11y): remove nested interactive controls from project cards

Each card was a div with role=button containing two real buttons, which is
invalid ARIA: screen readers announce the whole card as one control and the
inner buttons become ambiguous. Replaces it with the stretched-link pattern
- the title is the real button and its ::after covers the card - so the whole
surface stays clickable with one accessible control per action."
```

---

### Task 7: Add an error path to the resume viewer

Closes: **M2**

**Files:**
- Modify: `src/app/src/app/components/ResumeViewer.tsx` — add error state, `.catch` on all three PDF.js promise chains, error UI

**Interfaces:**
- Consumes: `documents.resume` from `portfolio.ts` (a URL string), unchanged.
- Produces: nothing exported. Internal state only.

**The problem.** `pdfjsLib.getDocument(documents.resume).promise.then(async (pdf) => {...})` at `:48` has no `.catch`, and neither do the `getPage` chains at `:78` and `:118`. A 404, a corrupt PDF, or a worker failure leaves `ResumeViewerSkeleton` pinned open forever with an unhandled rejection in the console and no way for the visitor to recover. `InteractiveBomViewer.tsx:41` already handles this correctly — this task brings the resume viewer to the same standard.

- [ ] **Step 1: Add error state**

Alongside the existing `useState` declarations near the top of the component, add:

```tsx
  const [loadError, setLoadError] = useState(false);
```

In the `if (!open)` reset branch of the first `useEffect` (which already resets `currentPage`, `totalPages`, `scale`, and `fitScale`), add:

```tsx
      setLoadError(false);
```

so reopening the dialog retries cleanly.

- [ ] **Step 2: Catch the document load failure**

Change the document load chain from:

```tsx
    pdfjsLib.getDocument(documents.resume).promise.then(async (pdf) => {
      if (cancelled) {
        pdf.destroy();
        return;
      }

      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);

      const page = await pdf.getPage(1);
      if (cancelled) {
        return;
      }
      const nextFit = calculateFitScale(page, viewerRef.current);
      setFitScale(nextFit);
      setScale(nextFit);
    });
```

to:

```tsx
    pdfjsLib
      .getDocument(documents.resume)
      .promise.then(async (pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(1);
        if (cancelled) {
          return;
        }
        const nextFit = calculateFitScale(page, viewerRef.current);
        setFitScale(nextFit);
        setScale(nextFit);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });
```

The `cancelled` guard in the catch matters: closing the dialog mid-load rejects the in-flight promise, and setting state on that path would flip an already-unmounted view into an error state.

- [ ] **Step 3: Catch the page render failures**

The `getPage` chains at `:78` and `:118` can also reject (a damaged page object, a cancelled render task). Append the same handler to each:

```tsx
      .catch(() => {
        setLoadError(true);
      });
```

Note that `renderTask.cancel()` rejects with a `RenderingCancelledException` during normal operation — page changes and zooms cancel in-flight renders deliberately. Guard against treating that as a failure:

```tsx
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "RenderingCancelledException") {
          return;
        }
        setLoadError(true);
      });
```

Use this guarded form for both render chains. The document-load catch in Step 2 does not need it.

- [ ] **Step 4: Render the error state**

Where the component currently renders the canvas (or the skeleton while loading), add a branch ahead of it. Match the surrounding token-based styling:

```tsx
        {loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="font-display text-lg font-semibold text-[var(--text-strong)]">
              The resume preview could not be loaded.
            </p>
            <p className="max-w-sm text-sm text-[var(--text-soft)]">
              The inline viewer failed to start. You can still download the PDF directly.
            </p>
            <a
              href={documents.resume}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-button)]"
            >
              <Download className="size-4" />
              Download resume
            </a>
          </div>
        ) : (
          /* existing canvas / skeleton markup unchanged */
        )}
```

`Download` comes from `lucide-react` — add it to the existing import at the top of the file if it is not already there. Read the current JSX before wrapping so the canvas ref and its container classes survive intact.

- [ ] **Step 5: Verify the failure path**

Temporarily point the viewer at a nonexistent file to exercise the error branch:

```bash
grep -n "resume:" src/app/src/app/data/portfolio.ts
```

Edit `documents.resume` to a bogus path (e.g. append `.broken`), run `npx pnpm@latest dev`, open the resume from the Home CTA or the contact pinout. Expected: the skeleton clears and the error panel appears with a working download link; the console shows no unhandled rejection.

**Revert the bogus path immediately**, reload, and confirm the resume renders normally, pages navigate, and zoom works (which also proves the `RenderingCancelledException` guard is not swallowing real renders or firing on deliberate cancels).

- [ ] **Step 6: Verify the build**

```bash
npx pnpm@latest build
```

Expected: exit 0. Confirm `dist/assets/ResumeViewer-*.js` is still emitted as a separate chunk — the lazy import in `Layout.tsx:26` must not have been disturbed.

- [ ] **Step 7: Commit**

```bash
git add src/app/src/app/components/ResumeViewer.tsx
git commit -m "fix: handle PDF load failures in the resume viewer

getDocument and both getPage chains had no rejection handler, so a 404 or a
worker failure left the skeleton pinned open forever with an unhandled
rejection. Adds an error state with a direct download fallback, guarding
against RenderingCancelledException, which is thrown during normal page and
zoom changes."
```

---

### Task 8: Gate the skeleton debug flag to development builds

Closes: **M3**

**Files:**
- Modify: `src/app/src/app/components/Skeletons.tsx:21-30`

**Interfaces:**
- Consumes: nothing.
- Produces: `FORCE_SKELETONS: boolean` and `FORCE_CARD_SKELETONS: boolean` keep their names, types, and exports. The four consumers (`Layout.tsx:333`, `BoardViewer.tsx:70`, `InteractiveBomViewer.tsx:66`, and `Skeletons.tsx:144`) need no changes.

**The problem.** The header comment says "TEMPORARY design-review flag. Remove once the skeleton pass is signed off." It reads `?skeleton=` from the query string at module load and ships to production, where any visitor can pin every loading state open. Keeping the tool but making it dev-only preserves its usefulness and lets the bundler eliminate the production branch.

- [ ] **Step 1: Gate the flag on the dev build**

Replace:

```ts
const skeletonParam =
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("skeleton");

export const FORCE_SKELETONS = skeletonParam !== null;
export const FORCE_CARD_SKELETONS = skeletonParam === "cards";
```

with:

```ts
const skeletonParam =
  import.meta.env.DEV && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("skeleton")
    : null;

export const FORCE_SKELETONS = skeletonParam !== null;
export const FORCE_CARD_SKELETONS = skeletonParam === "cards";
```

`import.meta.env.DEV` is a Vite compile-time constant: it is `false` in production builds, so the whole expression folds to `null` and both exports fold to `false`, letting the minifier drop the four consuming branches.

- [ ] **Step 2: Update the comment to match reality**

Replace the block comment above it:

```ts
/* --------------------------------------------------------------------------
 * Development-only design-review flag. Compiled out of production builds by
 * `import.meta.env.DEV`, so the query string has no effect on the live site.
 *
 *   ?skeleton=1      pin every loading placeholder open; the app stays
 *                    navigable so modals and viewers can still be opened
 *   ?skeleton=cards  the above, plus swap the projects grid for card skeletons
 *
 * Read once at module load - the query string cannot change without a reload
 * (navigation here is hash-based, which leaves the search params intact).
 * ----------------------------------------------------------------------- */
```

- [ ] **Step 3: Verify the dev behavior still works**

```bash
npx pnpm@latest dev
```

Open `http://localhost:5173/?skeleton=1`. Expected: every skeleton is pinned open and the "Skeleton preview" badge shows in the bottom-left. Open `?skeleton=cards`. Expected: the projects grid shows card skeletons too.

- [ ] **Step 4: Verify the production build drops it**

```bash
npx pnpm@latest build
grep -c "skeleton=" dist/assets/index-*.js
```

Expected: `0` — the query-string read is gone from the bundle.

```bash
npx pnpm@latest preview
```

Open the preview URL with `?skeleton=1` appended. Expected: the site renders normally, with no pinned skeletons and no badge.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/components/Skeletons.tsx
git commit -m "chore: restrict the skeleton preview flag to development builds

The ?skeleton= debug flag shipped to production and was branched on in four
components, letting any visitor pin every loading state open. Gating it on
import.meta.env.DEV keeps the tool for local design review while folding the
production branches out at build time."
```

---

## Phase B — Improve (Tasks 9-14)

### Task 9: Delete unused shadcn components and prune orphaned dependencies

Closes: **M1**

**Files:**
- Delete: 43 files under `src/app/src/app/components/ui/`
- Modify: `package.json` (remove ~30 dependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: `components/ui/` retains exactly `badge.tsx`, `button.tsx`, `dialog.tsx`, `utils.ts`, `use-mobile.ts`. Every later task may import only from those.

**Evidence.** Verified by checking each `ui/*.tsx` for importers outside `ui/`: only `badge` (2 importers), `button` (8), and `dialog` (6) have any. The other 43 are unreferenced, and ~30 packages exist solely to serve them. Tree-shaking already keeps them out of `dist`, so this is install-time and maintenance cost — plus 43 files of unreviewed third-party-derived code carrying CVE surface.

Do this **before** Task 10's type check, or you will spend an afternoon fixing type errors in files you are about to delete.

- [ ] **Step 1: Re-confirm the usage list before deleting anything**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
for f in src/app/src/app/components/ui/*.tsx; do
  n=$(basename "$f" .tsx)
  c=$(grep -rl "ui/$n" src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v "components/ui/" | wc -l | tr -d ' ')
  [ "$c" != "0" ] && echo "KEEP: $n ($c importers)"
done
```

Expected: exactly three lines — `badge`, `button`, `dialog`. If anything else appears, keep it too and adjust the deletion list. Do not proceed on a stale list.

- [ ] **Step 2: Check for intra-ui dependencies of the survivors**

```bash
grep -n "from \"\./" src/app/src/app/components/ui/badge.tsx \
                     src/app/src/app/components/ui/button.tsx \
                     src/app/src/app/components/ui/dialog.tsx
```

Expected: imports of `./utils` only. If a survivor imports another `ui/` file, add that file to the keep list.

- [ ] **Step 3: Delete the unused components**

```bash
cd src/app/src/app/components/ui
git rm accordion.tsx alert-dialog.tsx alert.tsx aspect-ratio.tsx avatar.tsx \
       breadcrumb.tsx calendar.tsx card.tsx carousel.tsx chart.tsx checkbox.tsx \
       collapsible.tsx command.tsx context-menu.tsx drawer.tsx dropdown-menu.tsx \
       form.tsx hover-card.tsx input-otp.tsx input.tsx label.tsx menubar.tsx \
       navigation-menu.tsx pagination.tsx popover.tsx progress.tsx radio-group.tsx \
       resizable.tsx scroll-area.tsx select.tsx separator.tsx sheet.tsx sidebar.tsx \
       skeleton.tsx slider.tsx sonner.tsx switch.tsx table.tsx tabs.tsx textarea.tsx \
       toggle-group.tsx toggle.tsx tooltip.tsx
cd /Users/cameron/Documents/WebsitePrototype-main
ls src/app/src/app/components/ui/
```

Expected remaining: `badge.tsx`, `button.tsx`, `dialog.tsx`, `use-mobile.ts`, `utils.ts`.

Note `skeleton.tsx` is in the delete list — that is the unused shadcn primitive. The app's real loaders are `src/app/src/app/components/Skeletons.tsx` (capital S, one directory up), which is **not** being deleted. Confirm before running:

```bash
ls src/app/src/app/components/Skeletons.tsx
```

- [ ] **Step 4: Confirm the build still passes on the deletion alone**

```bash
npx pnpm@latest build
```

Expected: exit 0. If it fails, an importer was missed — restore the named file with `git checkout -- <path>` and re-run Step 1.

- [ ] **Step 5: Find dependencies with no remaining consumers**

```bash
for d in recharts react-hook-form embla-carousel-react vaul cmdk input-otp \
         react-day-picker sonner next-themes react-resizable-panels; do
  c=$(grep -rl "\"$d\|'$d" src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
  echo "$d: $c"
done
```

Expected: `0` for all ten. Then the Radix packages:

```bash
grep -o '"@radix-ui/[a-z-]*"' package.json | sort -u | while read -r pkg; do
  name=$(echo "$pkg" | tr -d '"')
  c=$(grep -rl "$name" src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
  echo "$name: $c"
done
```

Expected: non-zero only for `@radix-ui/react-dialog` and `@radix-ui/react-slot`. Anything else reporting non-zero must be kept.

- [ ] **Step 6: Remove the orphaned dependencies**

Remove from `package.json` `dependencies`: the ten packages from Step 5's first list, plus every `@radix-ui/*` that reported `0`. **Keep** `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `motion`, `pdfjs-dist`, `react`, `react-dom`, and `tw-animate-css` — all are confirmed in use.

Do not touch `devDependencies`, and do not touch the `pnpm.overrides` block.

```bash
npx pnpm@latest install
```

- [ ] **Step 7: Verify no behavioral change**

Before this task, `dist/assets/index-*.js` was **545.51 kB** (gzip 164.20). Run:

```bash
npx pnpm@latest build
```

Expected: exit 0, and the main chunk within a few KB of 545.51 kB. Tree-shaking already excluded these packages, so a *large* drop would mean something in use was removed — investigate rather than celebrate.

Run `npx pnpm@latest preview` and do a full manual pass: all six sections render; the project modal, organization modal, resume viewer, 3D board viewer, and interactive BOM all open and close; the theme toggle works; the sidebar expands and collapses. Console clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete unused shadcn components and prune orphaned deps

43 of 46 components under ui/ had no importer outside ui/, and roughly 30
packages existed only to serve them. Tree-shaking already kept them out of
the bundle, so this removes install and maintenance cost plus unreviewed
third-party-derived code. Main chunk size is unchanged, which confirms
nothing in use was removed."
```

---

### Task 10: Add TypeScript configuration and a CI type gate

Closes: **M8 (part 1)**

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json` (add `typecheck` script)
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm typecheck` runs `tsc --noEmit`. Task 11 adds `pnpm test` alongside it.

**Context.** There is no `tsconfig.json` today. Vite/esbuild transpiles TS without type-checking, and `pnpm build` does not run `tsc`, so type errors have never failed a build or a deploy. Expect the first run to surface real errors in code that has never been checked — budget an afternoon. Land the config with settings that pass before wiring the CI gate, then tighten separately.

- [ ] **Step 1: Create the config**

Create `tsconfig.json` at the repo root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "allowJs": false,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist", "public", "tools", "node-local"]
}
```

Notes on the choices: `paths` mirrors the `@` alias in `vite.config.ts`. `types: ["vite/client"]` is what makes `import.meta.env.DEV` (used by Task 8) type-check. `strict: false` is a deliberate starting point on a codebase that has never been checked — Step 4 ratchets it. `public` is excluded because `board-viewer-shell.html`'s inline JS is not part of the app's type graph. `tools` is excluded because those are standalone Node scripts. `tests/**/*.ts` and `vitest.config.ts` are listed ahead of those files existing — Tasks 11 and 18 create them — which is harmless: a glob matching nothing is not an error while other patterns match.

- [ ] **Step 2: Add the script**

In `package.json` `scripts`, add:

```json
    "typecheck": "tsc --noEmit",
```

TypeScript is not currently a dependency. Add it to `devDependencies` and install:

```bash
npx pnpm@latest add -D typescript@5.7.3
```

- [ ] **Step 3: Run it and fix what it finds**

```bash
npx pnpm@latest typecheck
```

Expected on a first run: some errors. Fix each one properly — do **not** add `@ts-ignore` or `any` to silence them. The codebase currently has zero of either (verified), and that is worth preserving.

Likely categories: implicit `any` on event handler parameters, missing null checks on `ref.current`, PDF.js types, and possibly the `viewerMode`/`viewerModelUrl` fields left behind by Task 2. If a fix would require restructuring a component, note it and relax the specific option rather than doing surgery inside a config task.

Re-run until it exits 0.

- [ ] **Step 4: Ratchet strictness as far as it will go cleanly**

Set `"strict": true` and re-run `npx pnpm@latest typecheck`. If the error count is small (under about 20), fix them and keep `strict: true`. If it is large, revert to `strict: false` and instead enable the individual flags that pass today:

```json
    "noImplicitAny": true,
    "strictNullChecks": true,
```

trying each one separately. Leave a comment in the commit message recording which flags are still off, so the next pass knows where to pick up.

- [ ] **Step 5: Wire the CI gate**

In `.github/workflows/pages.yml`, insert between the "Install dependencies" and "Build" steps:

```yaml
      - name: Type check
        run: pnpm typecheck
```

Order matters: the gate must run before the build, so a type error fails the job before anything is uploaded to Pages.

- [ ] **Step 6: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest build
```

Expected: both exit 0.

Verify the gate actually gates — temporarily introduce an error:

```bash
echo "const broken: number = 'string';" >> src/app/src/app/lib/board-assets.ts
npx pnpm@latest typecheck
```

Expected: non-zero exit with a type error. Remove the line and re-run to confirm it is clean again.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json package.json pnpm-lock.yaml .github/workflows/pages.yml src/
git commit -m "build: add tsconfig and gate CI on tsc --noEmit

The project had no tsconfig, so type errors never failed a build or a deploy.
Adds a config matching the Vite aliases and a typecheck script, fixes the
errors the first run surfaced, and inserts the gate before the build step in
the Pages workflow."
```

---

### Task 11: Add Vitest and the first four tests

Closes: **M8 (part 2)**

**Files:**
- Create: `vitest.config.ts`
- Create: `src/app/src/app/lib/routing.ts`
- Create: `tests/routing.test.ts`
- Create: `tests/portfolio-data.test.ts`
- Modify: `src/app/src/app/components/Layout.tsx` (import routing from the new module)
- Modify: `package.json` (add `test` script, Vitest devDependency)
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `projects`, `organizations`, `updateFeed`, `getOrganizationById`, `getProjectBySlug` from `portfolio.ts`.
- Produces:
  - `src/app/src/app/lib/routing.ts` exports:
    - `SECTION_IDS: readonly ["home","education","experience","projects","skills","contact"]`
    - `type SectionId = (typeof SECTION_IDS)[number]`
    - `type ViewId = "portfolio" | "updates"`
    - `isSectionId(value: string): value is SectionId`
    - `parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null }`
  - Task 16 consumes all of these by these exact names.
  - `Layout.tsx` must re-export `SectionId` so existing importers of `Layout`'s type keep working.

**Why these four tests.** They cover the two things most likely to break in normal use: hash routing (owns every deep link, currently untestable only because it is not exported) and content integrity in `portfolio.ts` (the file edited most often, where a typo silently produces a broken modal or a missing image).

- [ ] **Step 1: Install Vitest**

```bash
npx pnpm@latest add -D vitest@2.1.8
```

Vitest reuses the Vite pipeline, so no new build configuration is needed.

- [ ] **Step 2: Create the config**

Create `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

`environment: "node"` is correct for all four tests — they exercise pure functions and data, no DOM. Do not add jsdom; nothing here needs it.

- [ ] **Step 3: Add the script**

In `package.json` `scripts`:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Extract the routing logic so it can be imported**

Create `src/app/src/app/lib/routing.ts`:

```ts
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
```

This is the existing implementation moved verbatim — do not change its behavior in this task.

- [ ] **Step 5: Point Layout.tsx at the new module**

In `Layout.tsx`, delete the local `SECTION_IDS`, `SectionId`, `ViewId`, `isSectionId`, and `parseHash` declarations, and import them instead:

```tsx
import { isSectionId, parseHash, SECTION_IDS, type SectionId, type ViewId } from "../lib/routing";
```

`Layout.tsx` currently does `export type SectionId = ...`. Other files may import that type, so preserve the public surface with a re-export:

```tsx
export type { SectionId } from "../lib/routing";
```

Confirm nothing else broke:

```bash
grep -rn "from \"./Layout\"\|from \"../components/Layout\"" src --include='*.tsx' --include='*.ts'
```

- [ ] **Step 6: Write the failing routing test**

Create `tests/routing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseHash } from "../src/app/src/app/lib/routing";
import { projects } from "../src/app/src/app/data/portfolio";

describe("parseHash", () => {
  it("defaults to the portfolio home view for an empty hash", () => {
    expect(parseHash("")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("routes #/updates to the updates view", () => {
    expect(parseHash("#/updates")).toEqual({ view: "updates", section: "home", project: null });
  });

  it("routes a known section id to that section", () => {
    expect(parseHash("#/education")).toEqual({ view: "portfolio", section: "education", project: null });
  });

  it("routes a known project slug to the projects section with that project", () => {
    const slug = projects[0].slug;
    const result = parseHash(`#/projects/${slug}`);
    expect(result.view).toBe("portfolio");
    expect(result.section).toBe("projects");
    expect(result.project?.slug).toBe(slug);
  });

  it("falls back to home for an unknown project slug", () => {
    expect(parseHash("#/projects/does-not-exist")).toEqual({
      view: "portfolio",
      section: "home",
      project: null,
    });
  });

  it("falls back to home for an unknown section", () => {
    expect(parseHash("#/nonsense")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("tolerates a hash with no leading slash", () => {
    expect(parseHash("#skills")).toEqual({ view: "portfolio", section: "skills", project: null });
  });
});
```

- [ ] **Step 7: Run the test to see it pass**

```bash
npx pnpm@latest test
```

Expected: 7 passing. Because this is characterization of existing behavior rather than new functionality, the tests pass immediately — that is correct here. To prove they are real, temporarily break `parseHash` (change the `"updates"` literal to `"update"`), re-run, confirm a failure, then revert.

- [ ] **Step 8: Write the content integrity test**

Create `tests/portfolio-data.test.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getOrganizationById,
  getProjectBySlug,
  organizations,
  projects,
  updateFeed,
} from "../src/app/src/app/data/portfolio";

const publicDir = path.resolve(__dirname, "../public");

/** Asset paths in portfolio.ts are site-absolute ("/portfolio/..."), which map
 *  to files under public/ at build time. */
function resolveAsset(assetPath: string) {
  return path.join(publicDir, assetPath.replace(/^\//, ""));
}

describe("portfolio content integrity", () => {
  it("every project references an organization that exists", () => {
    for (const project of projects) {
      expect(getOrganizationById(project.organizationId), `project "${project.slug}"`).toBeTruthy();
    }
  });

  it("every project slug is unique and resolvable", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(getProjectBySlug(slug)?.slug).toBe(slug);
    }
  });

  it("every referenced media and document asset exists on disk", () => {
    const missing: string[] = [];

    for (const project of projects) {
      const assets = [project.cardImg, project.bannerImg, project.hoverImg, project.bomUrl];
      for (const asset of assets) {
        if (typeof asset === "string" && asset.startsWith("/") && !existsSync(resolveAsset(asset))) {
          missing.push(`${project.slug}: ${asset}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("updateFeed is sorted newest first and every entry resolves its organization", () => {
    for (let index = 1; index < updateFeed.length; index += 1) {
      expect(updateFeed[index - 1].sortKey >= updateFeed[index].sortKey).toBe(true);
    }

    for (const entry of updateFeed) {
      expect(organizations.some((org) => org.id === entry.organizationId)).toBe(true);
    }
  });
});
```

Before running, confirm the property names against `portfolio.ts` — `UpdateFeedEntry` is declared around `:785` and `sortKey`/`organizationId` must match its actual fields. Fix the test to match the source, not the other way round.

- [ ] **Step 9: Run and fix what it finds**

```bash
npx pnpm@latest test
```

If the asset test fails, it has found real broken media references — fix the paths in `portfolio.ts` or add the missing files. That is the test doing its job, not a bad test.

- [ ] **Step 10: Wire the CI gate**

In `.github/workflows/pages.yml`, add after the "Type check" step from Task 10:

```yaml
      - name: Test
        run: pnpm test
```

- [ ] **Step 11: Verify the whole chain**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all three exit 0.

Run `npx pnpm@latest dev` and click through every section and every deep link (`#/education`, `#/projects/<slug>`, `#/updates`) to confirm the routing extraction changed no behavior.

- [ ] **Step 12: Commit**

```bash
git add vitest.config.ts tests/ src/app/src/app/lib/routing.ts \
        src/app/src/app/components/Layout.tsx package.json pnpm-lock.yaml \
        .github/workflows/pages.yml
git commit -m "test: add vitest with routing and content integrity coverage

Extracts parseHash and the section id helpers out of Layout into lib/routing
so they are importable, then covers the seven hash-route shapes and the
content invariants most likely to break during a content edit: org
references, slug uniqueness, asset paths resolving to real files, and
updateFeed ordering. Gates CI on the suite."
```

---

### Task 12: Optimize images and fix the duplicated headshot

Closes: **M7**

**Files:**
- Modify: `src/app/src/app/components/Home.tsx` (headshot markup)
- Modify/Add: files under `public/portfolio/assets/media/` and `public/portfolio/assets/headshot.*`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing exported.

**Evidence.** `headshot.jpg` is 320 KB, rendered by two separate `<img>` elements (a `lg:hidden` mobile one and a `hidden lg:block` desktop one), both eager, neither with intrinsic dimensions. Twelve PNGs under `media/` exceed 200 KB, topping out at 516 KB. A WebP pipeline already exists — use it rather than inventing one.

- [ ] **Step 1: Read the existing pipeline before touching any asset**

There is an `optimize-media` skill under `.claude/skills/` and a `tools/optimize-media.py` script. Read the skill first — it documents how originals in `assets-src/media-originals/` relate to the served copies under `public/portfolio/assets/media/`. Do not re-encode a served file in place if the pipeline expects to regenerate it from an original.

- [ ] **Step 2: List the offenders**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
find public/portfolio/assets/media public/portfolio/assets/headshot.jpg -type f -size +200k \
  -exec du -h {} + | sort -rh
```

Expected: about 13 files, headed by `brick-buck-board-layout-hero.png` (516 K), `resume-preview-page-1.png` (548 K), `thermal-camera-schematic-card.png` (476 K), `aux-control-board-card.png` (440 K), `paradigm-logo.png` and `paradigm-marker.png` (352 K each).

- [ ] **Step 3: Run the pipeline**

Follow the `optimize-media` skill's documented invocation to downscale and re-encode each file above to WebP. Do not hand-roll `cwebp` calls if the skill specifies otherwise.

Two cautions: `paradigm-logo.png` and `paradigm-marker.png` are logos that may need transparency preserved — WebP supports alpha, but verify the result against a dark background. `resume-preview-page-1.png` is a document preview where text legibility matters more than bytes; use a higher quality setting for it.

- [ ] **Step 4: Update the references**

```bash
grep -rn "\.png\|\.jpg" src/app/src/app/data/portfolio.ts | head -40
```

Update each path whose file was converted. `portfolio.ts` is the single source of truth for these — do not update paths in components.

- [ ] **Step 5: Collapse the duplicated headshot**

In `Home.tsx`, the two `<img>` blocks render the same source at different breakpoints. Replace both wrappers with one image that carries dimensions and a WebP source. Keep the two gradient overlays, which differ by breakpoint:

```tsx
          <div className="relative w-full shrink-0 overflow-hidden lg:w-56 xl:w-64">
            <div className="relative h-56 w-full lg:absolute lg:inset-0 lg:h-auto">
              <picture>
                <source srcSet="/portfolio/assets/headshot.webp" type="image/webp" />
                <img
                  src="/portfolio/assets/headshot.jpg"
                  alt={profile.name}
                  width={512}
                  height={640}
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/60 to-transparent lg:hidden" />
              <div className="absolute inset-y-0 left-0 hidden w-8 bg-gradient-to-r from-[var(--surface-1)] to-transparent lg:block" />
            </div>
          </div>
```

Set `width`/`height` to the actual intrinsic dimensions of the optimized file (`sips -g pixelWidth -g pixelHeight public/portfolio/assets/headshot.webp` on macOS) — they reserve layout space and prevent the shift, so wrong values are worse than none. Deliberately **no** `loading="lazy"`: this is above the fold and a likely LCP element, so lazy-loading it would delay the largest paint.

Update the `HEADSHOT` constant at the top of `Home.tsx` or remove it if the paths are now inline.

- [ ] **Step 6: Verify**

```bash
du -sh public/portfolio/assets/media
```

Expected: meaningfully below the starting 9.1 MB — target under 5 MB.

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0. The content-integrity test from Task 11 will catch any path updated in `portfolio.ts` that no longer resolves — that is exactly why it was written first.

Run `npx pnpm@latest dev` and visually inspect every project card, every hover image, the experience logos, the report page previews, and the headshot at 375px, 768px, and 1440px. Look for compression artifacts on the schematics, where fine lines suffer first.

In DevTools, confirm the headshot appears once in the Elements panel (not twice) and once in the Network tab.

- [ ] **Step 7: Commit**

```bash
git add public/portfolio/assets src/app/src/app/data/portfolio.ts \
        src/app/src/app/components/Home.tsx
git commit -m "perf: optimize oversized media and de-duplicate the headshot

Thirteen images exceeded 200 KB, and the 320 KB headshot was rendered by two
separate img elements at different breakpoints, so both downloaded. Runs the
existing optimize-media pipeline over the offenders and collapses the
headshot to a single picture element with intrinsic dimensions, which also
removes a layout-shift source above the fold."
```

---

### Task 13: Delete stale duplicates and correct the documentation

Closes: **L1, L2, L3**

**Files:**
- Delete: `src/styles/default_theme.css`, `src/styles/index.css`, `src/app/default_shadcn_theme.css`, `default_shadcn_theme.css` (root)
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Prove the stale stylesheets are unreferenced**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
grep -rn "styles/index.css\|default_shadcn_theme\|src/styles" \
  src/main.tsx index.html vite.config.ts src/app/src/styles/ postcss.config.mjs
```

Expected: `src/main.tsx` imports `./app/src/styles/index.css` and nothing references the root `src/styles/` copies or either `default_shadcn_theme.css`. If anything does reference them, stop and investigate rather than deleting.

- [ ] **Step 2: Delete them**

```bash
git rm src/styles/default_theme.css src/styles/index.css \
       src/app/default_shadcn_theme.css default_shadcn_theme.css
ls src/
```

Expected: `src/` now contains `main.tsx` and `app/` only. If `src/styles/` is left empty, git removes it automatically.

- [ ] **Step 3: Confirm the build is unaffected**

```bash
npx pnpm@latest build
```

Expected: exit 0, and `dist/assets/index-*.css` at roughly its previous size (about 131 kB). A size change would mean a deleted file was actually being imported.

- [ ] **Step 4: Fix the stale claims in README.md**

Three corrections:

1. Under "Notes", replace:
   ```
   The contact form is local prototype behavior only. It does not submit to a backend service.
   ```
   with:
   ```
   The contact section is a PCB-pinout layout with copy-to-clipboard, mailto, and direct
   document links. There is no form and no backend service.
   ```

2. In "Project Structure", the styles line reads `styles/globals.css` under `src/app/src/app/`. The actual path is `src/app/src/styles/`. Replace that block with:
   ```text
   src/app/src/app/
     App.tsx                 Main application entry
     components/             Portfolio pages, modals, viewers, and layout pieces
     data/portfolio.ts       Typed portfolio content and project records
     lib/                    Routing helpers, board asset loading
     hooks/                  Hash routing and modal stack state
   src/app/src/styles/
     index.css               Style entry (imports the two below)
     default_theme.css       Tailwind @theme inline block
     globals.css             Light and dark semantic tokens
   ```
   Add the `hooks/` line only after Tasks 16 and 17 have created that directory; if this task runs first, omit it and let Task 17 add it.

3. Under "Content Updates", replace the geometry sentence:
   ```
   3D board models use prebuilt geometry bundles served from `public/portfolio/assets/scripts/viewer/board-model-data.js`.
   ```
   with:
   ```
   The 3D board viewer fetches quantized binary geometry per board from
   `public/portfolio/assets/viewers/geometry/<asset>.pcbgeo`, inside the viewer iframe.
   Regenerate with `npx pnpm@latest build:geometry`. See the `rebuild-board-geometry` skill.
   ```

4. In "Useful Commands", add the two new scripts:
   ```bash
   npx pnpm@latest typecheck
   npx pnpm@latest test
   ```

- [ ] **Step 5: Fix the stale claims in CLAUDE.md**

Under "Gotchas", the first bullet claims `node-local` is a tracked file. Verify:

```bash
git ls-files node-local
grep -n "node-local" .gitignore
```

Expected: the first prints nothing; the second shows it is ignored. Replace the bullet with:

```markdown
- **`node-local` is a ~230MB file** (a bundled Node runtime, not a directory) sitting in the
  working tree. It is gitignored, but its size still makes `git status` slow (multi-second
  index refresh). Expect git operations to lag; run them in the background if they exceed
  the tool timeout.
```

Also update the "no test suite / no tsconfig" claim in the Commands section, which Tasks 10 and 11 invalidated:

```markdown
Package manager is **pnpm** (Node 20+). `pnpm typecheck` runs `tsc --noEmit` and `pnpm test`
runs Vitest; both gate CI ahead of the build. `pnpm build` itself still does not run `tsc`,
so verify locally with `pnpm typecheck && pnpm test && pnpm build`.
```

And update the styles paragraph if it still describes the root `src/styles/` duplicate as existing — it no longer does after Step 2.

- [ ] **Step 6: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

Re-read both documents start to finish and check every factual claim against the tree — file paths, command names, script names. This is a documentation task; a stale line left behind is the defect.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: delete stale duplicate stylesheets and correct the docs

Removes three unreferenced copies of the theme stylesheets that shadowed the
live ones under src/app/src/styles. Corrects README claims about a contact
form that does not exist, the styles path, and the retired board-model-data
geometry bundle, and fixes the CLAUDE.md claim that node-local is tracked
when it is gitignored."
```

---

### Task 14: Modernize link rel attributes and text decoding, delete orphaned prototype scripts

Closes: **L7, L8, L11**

**Files:**
- Modify: `src/app/src/app/components/Home.tsx` (2 sites), `Contact.tsx` (2 sites), `ProjectModal.tsx` (2 sites)
- Modify: `src/app/src/app/lib/board-assets.ts:29-31`
- Delete: `public/portfolio/assets/scripts/ui/pdf-viewer.js`, `public/portfolio/assets/scripts/ui/adaptive-cursor.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `decodeBase64Html(payload: string): string` keeps its name and signature.

- [ ] **Step 1: Add noopener alongside noreferrer**

```bash
grep -rn 'rel="noreferrer"' src/app/src/app/components/
```

Expected: six results across `Home.tsx`, `Contact.tsx`, and `ProjectModal.tsx`. Replace each with:

```tsx
rel="noopener noreferrer"
```

`noreferrer` already implies `noopener` in every current browser, so this changes no behavior today — it is belt-and-braces against a browser that implements one and not the other, and it states the intent explicitly.

- [ ] **Step 2: Replace the deprecated escape() decoding**

In `src/app/src/app/lib/board-assets.ts`, replace:

```ts
function decodeBase64Html(payload: string) {
  return decodeURIComponent(escape(window.atob(payload)));
}
```

with:

```ts
/** Decodes a base64 payload as UTF-8. `atob` yields one byte per char, so the
 *  string has to go back through a byte array before TextDecoder can read it. */
function decodeBase64Html(payload: string) {
  const binary = window.atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
```

`escape()` is deprecated and its Latin-1 round-trip is an accident of history that happens to produce the right bytes. `TextDecoder` states the encoding.

- [ ] **Step 3: Delete the orphaned prototype scripts**

`public/portfolio/assets/scripts/ui/` holds two files left over from a pre-React prototype. Confirm nothing loads them:

```bash
grep -rn "pdf-viewer.js\|adaptive-cursor.js\|scripts/ui" src public index.html --include='*.ts' --include='*.tsx' --include='*.html'
```

Expected: no output. Then:

```bash
git rm public/portfolio/assets/scripts/ui/pdf-viewer.js public/portfolio/assets/scripts/ui/adaptive-cursor.js
```

`pdf-viewer.js:54` sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to a cdnjs URL — the last third-party CDN reference in the repository after Task 2. No page executes the file, so it is dead weight rather than an active vulnerability, but it ships to the deployed site and is directly reachable. The React app's own PDF viewing goes through `ResumeViewer.tsx` and the bundled `pdfjs-dist` worker, which is unaffected.

**Do not delete `public/portfolio/assets/scripts/viewer/board-viewer.js`** — despite the similar path, that one is live: `src/app/src/app/lib/board-assets.ts:20` fetches it to extract the embedded interactive BOM payloads.

Confirm afterwards that the repository is free of CDN references:

```bash
grep -rln "cdnjs\|jsdelivr\|unpkg\|cloudflare" public/ src/ index.html
```

Expected: no output.

- [ ] **Step 4: Verify the BOM still decodes**

The interactive BOM is exactly what this function decodes, so a wrong decode shows up as mojibake in the rendered BOM.

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
npx pnpm@latest preview
```

Open the Interactive BOM for a board that uses the embedded payload path (one where `project.bomUrl` is **not** set, so `loadInteractiveBom` takes the `board-viewer.js` extraction branch — check `portfolio.ts` for which). Expected: the BOM renders with correct component designators and no replacement characters (`�`). Also open a board that *does* set `bomUrl` to confirm the direct-fetch branch is unaffected.

Then click each external link (GitHub, LinkedIn, project demo/github) and confirm they still open in a new tab.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/src/app/components/ src/app/src/app/lib/board-assets.ts public/portfolio/assets/scripts/ui
git commit -m "chore: add noopener to external links, drop dead prototype scripts

rel=noreferrer already implies noopener in current browsers, but stating both
is the convention and guards against partial implementations. Also replaces
the escape()/decodeURIComponent base64 round-trip with TextDecoder, which
names the encoding instead of relying on a Latin-1 accident."
```

---

## Phase C — Polish (Tasks 15-20)

### Task 15: Sharpen the hero positioning and confirm the em-dash convention

Closes: **P21, L9**

**Files:**
- Modify: `src/app/src/app/data/portfolio.ts` — `profile.summary`, `profile.typedPhrases`
- Modify: `src/app/src/app/components/Home.tsx` — hero CTA row

**Interfaces:**
- Consumes: `featuredBoardProjects` (already imported by `Home.tsx`), `onOpen3D` prop (already threaded from `Layout.tsx`).
- Produces: nothing new.

**This task changes visitor-facing copy. Get the owner's sign-off on the wording in Step 2 before committing.**

- [ ] **Step 1: Confirm em-dash convention compliance**

```bash
grep -n "—" src/app/src/app/data/portfolio.ts
```

Expected: all 34 hits are in `period`, `company`, `role`, and `coursework` label fields (`"January 2026 — April 2026"`, `"ECE-3300 — Circuits & Electronics"`). The convention bans em-dashes in **prose description** fields only.

Check the prose fields specifically:

```bash
grep -n "description:\|summary:\|overview:" src/app/src/app/data/portfolio.ts | grep "—"
```

Expected: no output. If any line appears, rewrite that sentence to use a colon, a comma, or two sentences — not an en-dash substitute.

- [ ] **Step 2: Rewrite the summary to lead with evidence**

The current `profile.summary` is:

```ts
  summary:
    "Second-year electrical engineering student focused on PCB design, embedded systems, and hardware development.",
```

This is a category, not a differentiator. Replace with a version that leads with the thing almost no other student portfolio has:

```ts
  summary:
    "Second-year electrical engineering student who ships boards. Six documented builds with browser-inspectable 3D models, schematics, and bills of materials. Kraken Robotics co-op, Paradigm Engineering electrical.",
```

Also tighten `typedPhrases`, where "Embedded Systems Teammate" reads weak next to the other two:

```ts
  typedPhrases: ["Electrical Engineering Student", "PCB Design Builder", "Embedded Systems Developer"],
```

Confirm both with the owner before proceeding. If the project count changes, note that `stats` already derives from `projects.length` (Task 1) but this prose string does not — keep them consistent by hand, or reference the count from `projects.length` in a template literal.

- [ ] **Step 3: Surface the 3D viewer in the hero**

The 3D viewer is the portfolio's strongest differentiator and nothing above the fold announces it. `Home.tsx` already receives `onOpen3D` and imports `featuredBoardProjects`. Add a third CTA to the existing button row, after the Resume button:

```tsx
          {featuredBoardProjects[0] ? (
            <button
              type="button"
              onClick={() => onOpen3D(featuredBoardProjects[0])}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--outline-soft)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <Orbit className="size-4" />
              Inspect a board in 3D
            </button>
          ) : null}
```

`Orbit` is already imported in `Home.tsx` from `lucide-react`. The guard matters — `featuredBoardProjects` is derived by filtering, so it can be empty if the data changes.

- [ ] **Step 4: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

Run `npx pnpm@latest dev`. Confirm: the hero shows three CTAs that wrap correctly at 375px (the row is already `flex-wrap`); "Inspect a board in 3D" opens the board viewer directly from the hero; closing it returns to the portfolio without a stranded modal (this exercises the same `viewerReturnProject` path `Home.tsx` already uses at the featured-board carousel, which sets it to `null` first).

Run axe DevTools on the hero. Expected: the new button is a real `<button>` with a discernible name, no new violations.

- [ ] **Step 5: Commit**

```bash
git add src/app/src/app/data/portfolio.ts src/app/src/app/components/Home.tsx
git commit -m "content: lead with shipped-hardware evidence and surface the 3D viewer

The summary described a category that every EE student's portfolio claims.
Replaces it with the specifics that are actually rare here - documented
builds with browser-inspectable boards and a Kraken co-op - and adds a hero
CTA that opens a board in 3D, which was previously reachable only after
scrolling into the featured carousel."
```

---

### Task 16: Extract useHashRoute from Layout

Closes: **P23**

**Files:**
- Create: `src/app/src/app/hooks/useHashRoute.ts`
- Modify: `src/app/src/app/components/Layout.tsx`

**Interfaces:**
- Consumes: `parseHash`, `isSectionId`, `SECTION_IDS`, `SectionId`, `ViewId` from `../lib/routing` (created in Task 11).
- Produces: `useHashRoute(options)` returning:
  ```ts
  {
    view: ViewId;
    activeSection: SectionId;
    selectedProject: ProjectRecord | null;
    setView: (view: ViewId) => void;
    setActiveSection: (section: SectionId) => void;
    setSelectedProject: (project: ProjectRecord | null) => void;
    navigate: (target: PageId) => void;
  }
  ```
  Task 17 consumes `view`, `activeSection`, `selectedProject`, and `navigate` by these exact names.

**Do not attempt this before Task 11's routing tests exist.** They are the safety net for this extraction.

- [ ] **Step 1: Read the whole of Layout.tsx first**

The routing logic is four interlocking `useEffect`s plus `scrollToSection`, `handleNavigate`, and `pendingSectionRef`. They interact through `pendingSectionRef` in non-obvious ways — the deferred double-`requestAnimationFrame` scroll exists because the target section is not laid out yet on the frame the view switches. Read all of it before moving any of it.

- [ ] **Step 2: Create the hook with the logic moved verbatim**

Create `src/app/src/app/hooks/useHashRoute.ts`:

```ts
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { PageId, ProjectRecord } from "../data/portfolio";
import { isSectionId, parseHash, SECTION_IDS, type SectionId, type ViewId } from "../lib/routing";

interface UseHashRouteOptions {
  mainRef: RefObject<HTMLElement | null>;
  sectionRefs: RefObject<Partial<Record<SectionId, HTMLElement | null>>>;
}

export function useHashRoute({ mainRef, sectionRefs }: UseHashRouteOptions) {
  const initialRoute = parseHash(window.location.hash);
  const pendingSectionRef = useRef<SectionId | null>(
    initialRoute.view === "portfolio" && initialRoute.section !== "home" ? initialRoute.section : null,
  );

  const [view, setView] = useState<ViewId>(initialRoute.view);
  const [activeSection, setActiveSection] = useState<SectionId>(initialRoute.section);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(initialRoute.project);

  const scrollToSection = useCallback(
    (sectionId: SectionId) => {
      const element = sectionRefs.current?.[sectionId];
      if (!element) {
        return;
      }

      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      element.scrollIntoView({ behavior, block: "start" });
    },
    [sectionRefs],
  );

  const navigate = useCallback(
    (target: PageId) => {
      if (target === "updates") {
        setView("updates");
        return;
      }

      if (view !== "portfolio") {
        pendingSectionRef.current = target;
        setView("portfolio");
        return;
      }

      setActiveSection(target);
      scrollToSection(target);
    },
    [scrollToSection, view],
  );

  // Deferred scroll after switching back to the portfolio view; also covers the
  // initial deep-link scroll on mount. Two nested rAFs because the target
  // section is not laid out yet on the frame the view switches.
  useEffect(() => {
    if (view === "portfolio" && pendingSectionRef.current) {
      const sectionId = pendingSectionRef.current;
      pendingSectionRef.current = null;
      setActiveSection(sectionId);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSection(sectionId));
      });
    }

    if (view === "updates") {
      mainRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [mainRef, scrollToSection, view]);

  // Scroll spy: highlight the section currently in the middle of the screen.
  useEffect(() => {
    if (view !== "portfolio") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute("data-section");
            if (sectionId && isSectionId(sectionId)) {
              setActiveSection(sectionId);
            }
          }
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
    );

    for (const sectionId of SECTION_IDS) {
      const element = sectionRefs.current?.[sectionId];
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [sectionRefs, view]);

  useEffect(() => {
    const nextHash = selectedProject
      ? `#/projects/${selectedProject.slug}`
      : view === "updates"
        ? "#/updates"
        : `#/${activeSection}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [view, activeSection, selectedProject]);

  useEffect(() => {
    const onHashChange = () => {
      const route = parseHash(window.location.hash);
      setView(route.view);
      setSelectedProject(route.project);

      if (route.view === "portfolio") {
        pendingSectionRef.current = route.section;
        requestAnimationFrame(() => {
          if (pendingSectionRef.current) {
            const sectionId = pendingSectionRef.current;
            pendingSectionRef.current = null;
            setActiveSection(sectionId);
            scrollToSection(sectionId);
          }
        });
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [scrollToSection]);

  return { view, activeSection, selectedProject, setView, setActiveSection, setSelectedProject, navigate };
}
```

The `rootMargin: "-35% 0px -55% 0px"` value is load-bearing for the scroll-spy feel — copy it exactly, do not round it.

- [ ] **Step 3: Consume the hook in Layout**

In `Layout.tsx`, delete the `view`, `activeSection`, `selectedProject` state declarations, `pendingSectionRef`, `scrollToSection`, `handleNavigate`, and the four routing `useEffect`s. Replace with:

```tsx
  const { view, activeSection, selectedProject, setSelectedProject, navigate } = useHashRoute({
    mainRef,
    sectionRefs,
  });
```

Rename the two `onSelect={handleNavigate}` / `onNavigate={handleNavigate}` call sites to `navigate`. `mainRef` and `sectionRefs` stay declared in `Layout.tsx` because the JSX attaches them.

`setView` and `setActiveSection` come back from the hook but may now be unused in `Layout.tsx` — if so, drop them from the destructuring rather than leaving unused bindings.

- [ ] **Step 4: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

Run `npx pnpm@latest dev` and walk the full routing surface, since these are the behaviors the extraction can silently break:

1. Load `/` with no hash — lands on home, no scroll jump.
2. Load `/#/education` directly — scrolls to Education on mount.
3. Load `/#/projects/<slug>` directly — opens that project's modal.
4. Load `/#/projects/bogus-slug` — falls back to home, no modal, no crash.
5. Click each sidebar item — smooth scroll, sidebar highlight follows.
6. Scroll manually — the sidebar highlight tracks the section under the middle of the viewport.
7. Navigate to Updates, then back to a section — the deferred scroll lands correctly.
8. Use the browser back and forward buttons across several of the above.
9. Enable "Reduce motion" in OS settings and repeat step 5 — scrolling jumps instantly instead of animating.

- [ ] **Step 5: Verify CircuitTrace still renders**

The scroll-spy observes the same `[data-section]` elements CircuitTrace measures. Confirm at 1440px width that the PCB trace still draws its IC blocks in the inter-section gaps — count them; there should be six (rectifier, buck, LDO, MCU, FPGA, 555 timer). If any are missing, the section refs are not being registered and the extraction dropped a wire.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/hooks/useHashRoute.ts src/app/src/app/components/Layout.tsx
git commit -m "refactor: extract useHashRoute from Layout

Layout owned four interlocking routing effects plus a deferred-scroll ref
alongside eleven pieces of modal state. Moves the routing half into a hook
with the logic unchanged, leaving Layout as composition. Behavior is
covered by the parseHash tests added earlier."
```

---

### Task 17: Extract the modal stack from Layout

Closes: **P24**

**Files:**
- Create: `src/app/src/app/hooks/useModalStack.ts`
- Modify: `src/app/src/app/components/Layout.tsx`

**Interfaces:**
- Consumes: `ProjectRecord`, `OrganizationRecord`, `getOrganizationById` from `../data/portfolio`; `selectedProject` / `setSelectedProject` from `useHashRoute` (Task 16).
- Produces: `useModalStack({ selectedProject, setSelectedProject })` returning:
  ```ts
  {
    selectedOrganization: OrganizationRecord | null;
    resumeOpen: boolean;
    reportProject: ProjectRecord | null;
    boardProject: ProjectRecord | null;
    bomProject: ProjectRecord | null;
    openOrganizationById: (orgId: string) => void;
    openOrganization: (project: ProjectRecord, restoreProject: boolean) => void;
    closeOrganization: () => void;
    openResume: () => void;
    closeResume: () => void;
    openReport: (project: ProjectRecord) => void;
    closeReport: () => void;
    openBoard: (project: ProjectRecord, returnToProject: boolean) => void;
    closeBoard: () => void;
    openBom: (project: ProjectRecord, returnToProject: boolean) => void;
    closeBom: () => void;
  }
  ```

**The duplication being removed.** `Layout.tsx` has the same close-then-restore block written three times — in `BoardViewer`'s `onOpenChange`, `InteractiveBomViewer`'s `onOpenChange`, and `OrganizationContextModal`'s `onOpenChange`. Each reads a "return to" ref, clears the modal, and conditionally restores the project. Two `useState`s (`viewerReturnProject`, `organizationReturnProject`) exist only to carry that.

- [ ] **Step 1: Write the hook**

Create `src/app/src/app/hooks/useModalStack.ts`:

```ts
import { useCallback, useState } from "react";

import { getOrganizationById, type OrganizationRecord, type ProjectRecord } from "../data/portfolio";

interface UseModalStackOptions {
  selectedProject: ProjectRecord | null;
  setSelectedProject: (project: ProjectRecord | null) => void;
}

export function useModalStack({ selectedProject, setSelectedProject }: UseModalStackOptions) {
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationRecord | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [reportProject, setReportProject] = useState<ProjectRecord | null>(null);
  const [boardProject, setBoardProject] = useState<ProjectRecord | null>(null);
  const [bomProject, setBomProject] = useState<ProjectRecord | null>(null);

  // A viewer opened from a project modal returns to it on close; one opened
  // from a card or the hero returns to the page. One ref covers every viewer
  // because only one is ever open at a time.
  const [returnProject, setReturnProject] = useState<ProjectRecord | null>(null);

  const restore = useCallback(() => {
    if (returnProject) {
      setSelectedProject(returnProject);
      setReturnProject(null);
    }
  }, [returnProject, setSelectedProject]);

  const openOrganizationById = useCallback((orgId: string) => {
    const organization = getOrganizationById(orgId);
    if (!organization) return;
    setReturnProject(null);
    setSelectedOrganization(organization);
  }, []);

  const openOrganization = useCallback(
    (project: ProjectRecord, restoreProject: boolean) => {
      const organization = getOrganizationById(project.organizationId);
      if (!organization) return;

      if (restoreProject) {
        setReturnProject(project);
        setSelectedProject(null);
      } else {
        setReturnProject(null);
      }

      setSelectedOrganization(organization);
    },
    [setSelectedProject],
  );

  const closeOrganization = useCallback(() => {
    setSelectedOrganization(null);
    restore();
  }, [restore]);

  const openViewer = useCallback(
    (setter: (project: ProjectRecord | null) => void) =>
      (project: ProjectRecord, returnToProject: boolean) => {
        setReturnProject(returnToProject ? project : null);
        setSelectedProject(null);
        setter(project);
      },
    [setSelectedProject],
  );

  const closeViewer = useCallback(
    (setter: (project: ProjectRecord | null) => void) => () => {
      setter(null);
      restore();
    },
    [restore],
  );

  return {
    selectedOrganization,
    resumeOpen,
    reportProject,
    boardProject,
    bomProject,
    openOrganizationById,
    openOrganization,
    closeOrganization,
    openResume: useCallback(() => setResumeOpen(true), []),
    closeResume: useCallback(() => setResumeOpen(false), []),
    openReport: useCallback(
      (project: ProjectRecord) => {
        setSelectedProject(null);
        setReportProject(project);
      },
      [setSelectedProject],
    ),
    closeReport: useCallback(() => setReportProject(null), []),
    openBoard: openViewer(setBoardProject),
    closeBoard: closeViewer(setBoardProject),
    openBom: openViewer(setBomProject),
    closeBom: closeViewer(setBomProject),
  };
}
```

Note `selectedProject` is in the options but unused in the body — it is there so the hook can be extended without changing its call signature. If your linter or `noUnusedParameters` objects, drop it from the interface and the destructuring.

One behavior to preserve exactly: opening the BOM **from inside the board viewer** (`BoardViewer`'s `onOpenBom`) currently closes the board and opens the BOM *without* clearing `viewerReturnProject`, so closing the BOM returns to the original project. `openBom(project, true)` reproduces that; verify it in Step 3.

- [ ] **Step 2: Rewire Layout**

In `Layout.tsx`, delete the five modal `useState`s plus `organizationReturnProject`, `viewerReturnProject`, `openOrganizationById`, and `openOrganization`. Replace with:

```tsx
  const modals = useModalStack({ selectedProject, setSelectedProject });
```

Then rewrite each modal's props to call the hook. For example, `BoardViewer` goes from an eight-line inline `onOpenChange` to:

```tsx
      <BoardViewer
        project={modals.boardProject}
        open={Boolean(modals.boardProject)}
        onOpenChange={(open) => {
          if (!open) modals.closeBoard();
        }}
        onOpenBom={(project) => {
          modals.closeBoard();
          modals.openBom(project, true);
        }}
      />
```

Apply the same shape to `ProjectModal`, `OrganizationContextModal`, `ReportViewer`, `InteractiveBomViewer`, and the resume `Suspense` block.

- [ ] **Step 3: Verify every open and close path**

There are nine transitions and each must be walked by hand. Run `npx pnpm@latest dev` and check:

1. Card → project modal → close. Returns to the page.
2. Card → project modal → 3D viewer → close. **Returns to the project modal.**
3. Hero "Inspect a board in 3D" (Task 15) → 3D viewer → close. **Returns to the page**, not to a modal.
4. Project modal → 3D viewer → Interactive BOM → close. **Returns to the project modal.**
5. Project modal → Interactive BOM → close. Returns to the project modal.
6. Project modal → organization modal → close. Returns to the project modal.
7. Card org header → organization modal → close. Returns to the page.
8. Experience section → organization modal → close. Returns to the page.
9. Organization modal → a project inside it → project modal → close. Returns to the page.
10. Resume from the hero, from Contact, and from the sidebar — opens and closes cleanly each time.

Items 2, 3, 4, and 6 are the return-path behaviors the refactor most easily breaks. Also confirm no two modals are ever open at once, and that Escape closes the topmost one.

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

- [ ] **Step 4: Commit**

Also add the `hooks/` line to the README project-structure block that Task 13 deliberately left out (it ran before this directory existed):

```text
  hooks/                  Hash routing and modal stack state
```

```bash
git add src/app/src/app/hooks/useModalStack.ts src/app/src/app/components/Layout.tsx README.md
git commit -m "refactor: extract the modal stack from Layout

The close-then-restore block was written verbatim three times, backed by two
separate return-to-project state variables. Consolidates them into one hook
with a single return ref, since only one viewer is ever open at a time,
leaving Layout as composition."
```

---

### Task 18: Extract the CircuitTrace geometry and test it

Closes: **L6**

**Files:**
- Create: `src/app/src/app/lib/circuit-geometry.ts`
- Create: `tests/circuit-geometry.test.ts`
- Modify: `src/app/src/app/components/CircuitTrace.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the exact exports are determined by reading the file (see Step 1). At minimum:
  ```ts
  export interface SectionRect { id: string; top: number; height: number }
  export interface SectionGap { top: number; bottom: number }
  export function computeGaps(sections: SectionRect[]): SectionGap[];
  export function placeCenterpieces(gaps: SectionGap[], availableWidth: number): PlacedCenterpiece[];
  ```

**This is the highest-risk task in the plan. Do it last, and do it in one sitting.** `CircuitTrace.tsx` is 2815 lines and its failure mode is silent: if the placement math breaks, the ICs simply do not render and nothing errors. The point of the extraction is to convert that silent failure into a test failure.

- [ ] **Step 1: Read the file and map the pure logic**

Read `CircuitTrace.tsx` in full — all of it, not just the measurement effect at `:2087-2140`. Identify precisely which code is pure (takes section rects and dimensions, returns placement decisions) and which touches the DOM, React state, or the animation loop. Only the pure part moves.

Known anchors from the review:
- The measure effect reads `offsetTop`/`offsetHeight` from every `[data-section]` element and forms inter-section gaps.
- `centerpieceQueue` = `rectifier → buck → ldo → mcu → fpga → timer555`, one dropped per usable gap.
- A gap is usable when `gap.bottom - gap.top >= 70`.
- The buck block additionally needs `avail >= 340`, derived from the full `<main>` width.
- A `stage` machine (`input → rail12 → rail33 → rail18 → load`) advances as each converter is placed and governs which decoupling parts sit on the bus.

Write down the actual constants and function names you find. **Do not trust the numbers in this plan over what the file says** — transcribe from the source.

- [ ] **Step 2: Move the pure functions with zero behavior change**

Create `src/app/src/app/lib/circuit-geometry.ts` and move the identified pure functions there verbatim — same names, same constants, same arithmetic. Export them. Import them back into `CircuitTrace.tsx`.

This step must be a pure move. Do not rename, do not "clean up", do not change a threshold. Any improvement is a separate commit after the tests exist.

- [ ] **Step 3: Verify the move changed nothing visually**

Before writing tests, prove the move is inert. Run `npx pnpm@latest dev` at 1440px and compare against `git stash`-ed original if needed:

- All six IC blocks render in the inter-section gaps.
- The power-rail flags read `AC IN → +12V → +3V3 → +1V8 → GND` down the trunk.
- The trace animates on scroll as before.
- At a narrow desktop width (about 1100px), the buck block drops out as it did before — that is the `avail >= 340` threshold working.

If anything differs, the move was not verbatim. Fix it before continuing.

- [ ] **Step 4: Write the threshold tests**

Create `tests/circuit-geometry.test.ts`. Adjust the imported names to whatever Step 1 actually found:

```ts
import { describe, expect, it } from "vitest";

import { computeGaps, placeCenterpieces } from "../src/app/src/app/lib/circuit-geometry";

/** Six stacked sections with a uniform gap between them, matching the shape
 *  Layout renders: space-y-16 lg:space-y-24 gives 96px on desktop. */
function sectionsWithGap(gapPx: number) {
  const ids = ["home", "education", "experience", "projects", "skills", "contact"];
  const sectionHeight = 800;
  return ids.map((id, index) => ({
    id,
    top: index * (sectionHeight + gapPx),
    height: sectionHeight,
  }));
}

describe("circuit geometry placement", () => {
  it("places every centerpiece at the desktop gap of 96px", () => {
    const gaps = computeGaps(sectionsWithGap(96));
    const placed = placeCenterpieces(gaps, 900);
    expect(placed).toHaveLength(6);
  });

  it("places nothing when the gap falls below the 70px threshold", () => {
    const gaps = computeGaps(sectionsWithGap(60));
    const placed = placeCenterpieces(gaps, 900);
    expect(placed).toHaveLength(0);
  });

  it("drops the buck block when horizontal room is under 340px", () => {
    const gaps = computeGaps(sectionsWithGap(96));
    const placed = placeCenterpieces(gaps, 300);
    expect(placed.some((piece) => piece.kind === "buck")).toBe(false);
  });

  it("produces one fewer gap than the number of sections", () => {
    expect(computeGaps(sectionsWithGap(96))).toHaveLength(5);
  });
});
```

The second test is the important one: it encodes the documented silent-failure mode ("reducing the desktop gap below ~70px drops every IC") as an executable assertion, so a future "tighten the spacing" change fails CI instead of quietly deleting the artwork.

- [ ] **Step 5: Run the tests**

```bash
npx pnpm@latest test
```

Expected: 4 passing. If a test fails, the assertion is probably wrong about the real implementation, not the implementation wrong about the assertion — re-read the source and correct the test. Then prove each test is real by temporarily changing the `70` threshold to `10` and confirming the second test fails.

- [ ] **Step 6: Full verification**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

Repeat the full visual check from Step 3, plus: scroll the whole page at 1440px watching for animation stutter, resize the window from 1440px down to 375px and back, and confirm the trace hides entirely under `prefers-reduced-motion: reduce` (the early bail in the file).

- [ ] **Step 7: Commit**

```bash
git add src/app/src/app/lib/circuit-geometry.ts tests/circuit-geometry.test.ts \
        src/app/src/app/components/CircuitTrace.tsx
git commit -m "refactor: extract CircuitTrace placement math and cover it with tests

The IC placement logic was buried in a 2815-line component and its failure
mode is silent - reduce the section gap below 70px and every block simply
stops rendering. Moves the pure section-gap and placement math into lib with
no behavior change, then encodes both thresholds as tests so a spacing change
fails CI instead of quietly deleting the artwork."
```

---

### Task 19: Add load progress to the 3D board viewer

Closes: **P26**

**Files:**
- Modify: `public/portfolio/assets/viewers/board-viewer-shell.html` (`fetchBoardGeometry`, postMessage)
- Modify: `src/app/src/app/components/BoardViewer.tsx` (progress state and display)

**Interfaces:**
- Consumes: the existing `viewer-ready` / `viewer-error` postMessage contract.
- Produces: a third message type `{ type: "viewer-progress", loaded: number, total: number }`, posted to `window.parent` with `window.location.origin` as the target origin. `total` is `0` when the server sends no `Content-Length`.

**Why.** `brick.pcbgeo` is 3.9 MB and `power.pcbgeo` is 1.6 MB. Today the visitor sees a static skeleton for the whole download with no indication that anything is happening or how long it will take.

- [ ] **Step 1: Report progress from the fetch**

In `board-viewer-shell.html`, `fetchBoardGeometry` currently does `const response = await fetch(url);` and reads the body. Wrap the body read in a progress-reporting reader. Insert after the response is obtained and its `ok` status is checked:

```js
          const total = Number(response.headers.get("Content-Length") || 0);
          const reader = response.body.getReader();
          const chunks = [];
          let loaded = 0;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            window.parent.postMessage(
              { type: "viewer-progress", loaded: loaded, total: total },
              window.location.origin,
            );
          }

          const buffer = new Uint8Array(loaded);
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
```

Then feed `buffer` into the existing gzip-sniffing path in place of whatever the current code obtains from `response.arrayBuffer()`. **Read the existing function carefully first** — it sniffs the gzip magic bytes to decide whether to run the payload through `DecompressionStream`, because whether the bytes arrive inflated depends on how the host serves the file. That logic must be preserved exactly; only the source of the bytes changes.

- [ ] **Step 2: Receive progress in BoardViewer**

In `BoardViewer.tsx`, add state next to `sceneReady`:

```tsx
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
```

Reset it alongside `setSceneReady(false)` in the same effect. Extend the existing message handler, keeping the origin and source checks exactly as they are:

```tsx
      const data = event.data as { type?: unknown; loaded?: number; total?: number } | null;
      const type = data?.type;

      if (type === "viewer-progress") {
        setProgress({ loaded: data?.loaded ?? 0, total: data?.total ?? 0 });
        return;
      }

      if (type === "viewer-ready" || type === "viewer-error") {
        setProgress(null);
        setSceneReady(true);
      }
```

- [ ] **Step 3: Display it on the skeleton**

Where `<BoardViewerSkeleton />` renders, overlay a progress readout in the existing mono label style:

```tsx
            {showBoard ? null : (
              <>
                <BoardViewerSkeleton />
                {progress ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--text-soft)]"
                  >
                    {progress.total > 0
                      ? `Loading board geometry ${Math.round((progress.loaded / progress.total) * 100)}%`
                      : `Loading board geometry ${(progress.loaded / 1_000_000).toFixed(1)} MB`}
                  </div>
                ) : null}
              </>
            )}
```

The `total > 0` branch matters: GitHub Pages may serve the pre-compressed file without a `Content-Length` the browser exposes, in which case a percentage would be wrong and the byte count is the honest readout. `aria-live="polite"` announces progress without interrupting.

- [ ] **Step 4: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
npx pnpm@latest preview
```

Open the Brick Buck board (the 3.9 MB payload) with DevTools Network throttled to "Fast 3G". Expected: the readout appears and climbs, then the board renders and the readout disappears. Confirm the percentage reaches 100 and does not exceed it.

Open the same board unthrottled. Expected: the readout may flash briefly or not appear at all — both are fine.

Open all three boards and confirm each still renders correctly. A mistake in the chunk-reassembly step corrupts the geometry, so a board that renders scrambled or not at all means Step 1 broke the gzip path.

Test the no-`Content-Length` branch by temporarily hardcoding `const total = 0;` and confirming the MB readout appears instead of a percentage. Revert.

- [ ] **Step 5: Commit**

```bash
git add public/portfolio/assets/viewers/board-viewer-shell.html \
        src/app/src/app/components/BoardViewer.tsx
git commit -m "feat: show download progress while board geometry loads

The largest board payload is 3.9 MB and the visitor saw only a static
skeleton for its entire download. Streams the fetch and posts progress to the
parent, falling back to a byte count when the host sends no Content-Length.
The gzip sniffing that decides whether to run the payload through
DecompressionStream is unchanged."
```

---

### Task 20: Add outcome evidence to the project write-ups

Closes: **P22**

**Files:**
- Modify: `src/app/src/app/data/portfolio.ts` — the `projects` array
- Possibly modify: `src/app/src/app/components/ProjectModal.tsx` if a new field needs rendering

**Interfaces:**
- Consumes: the existing `ProjectRecord` interface.
- Produces: if a field is added, it goes on `ProjectRecord` as `outcomes?: string[]` and `ProjectModal` renders it in a section headed "Outcome".

**This is content work and the owner writes the words.** The implementer's job is to prepare the structure, identify exactly which entries lack outcome evidence, and land the copy the owner supplies.

- [ ] **Step 1: Audit what each project currently documents**

```bash
grep -n "slug:\|designDecisions\|challenges\|takeaways\|outcomes" src/app/src/app/data/portfolio.ts
```

For each project, record which of the four narrative blocks it has. `ProjectModal` renders "Design Decisions", "Challenges", and "Takeaways" — all process. What is missing across the board is *outcome*: did it work, what was measured, how many revisions, what failed and what the fix cost.

- [ ] **Step 2: Add the field if the audit shows it is needed**

If outcome content does not fit the existing three blocks, add to `ProjectRecord`:

```ts
  /** What the build actually produced: measured results, revision count,
   *  failures and their fixes. Rendered as the "Outcome" block. */
  outcomes?: string[];
```

And in `ProjectModal.tsx`, alongside the existing three blocks (matching their markup exactly, with the heading level Task 3 established):

```tsx
                  {project.outcomes?.length ? (
                    <div>
                      <h3 className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Outcome</h3>
                      <ul className="mt-3 space-y-2 text-[0.98rem] leading-7 text-[var(--text-soft)]">
                        {project.outcomes.map((outcome) => (
                          <li key={outcome}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
```

Before writing this, open `ProjectModal.tsx:256-275` and read how `designDecisions`, `challenges`, and `takeaways` are rendered. If those use different list markup or different classes than shown above, copy theirs verbatim — the goal is that the new block is visually indistinguishable from its three neighbors, so the source of truth is the file, not this snippet. Place the Outcome block first among the four, since outcome is what a reader is scanning for.

- [ ] **Step 3: Draft the questions for the owner, per project**

For each project, the specific unanswered questions are:

- Did the board come back from fab working, or did it need rework?
- What was measured — efficiency, ripple, thermal rise, current draw, timing?
- How many revisions, and what drove each one?
- What failed, and what did the fix cost in time or parts?

`aux-power-hiccup-fix` is named as though it has exactly this story (a hiccup-mode fix implies a fault found and corrected). Make sure that entry tells it.

- [ ] **Step 4: Land the copy**

Add the owner's supplied text to the `projects` entries. Two constraints, both from the global constraints section: **no em-dashes** in these prose fields, and content goes in `portfolio.ts`, never inline in a component.

- [ ] **Step 5: Verify**

```bash
npx pnpm@latest typecheck && npx pnpm@latest test && npx pnpm@latest build
```

Expected: all exit 0.

```bash
grep -n "outcomes:" src/app/src/app/data/portfolio.ts | wc -l
```

Compare against the project count — note any entry still without outcome content and report it rather than inventing copy for it.

```bash
grep -n "outcomes:" -A6 src/app/src/app/data/portfolio.ts | grep "—"
```

Expected: no output (em-dash convention).

Run `npx pnpm@latest dev`, open every project modal, and confirm the Outcome block renders where content exists and is cleanly absent where it does not.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/data/portfolio.ts src/app/src/app/components/ProjectModal.tsx
git commit -m "content: add outcome evidence to project write-ups

The modals documented design decisions, challenges, and takeaways - all
process - with no record of what the builds actually produced. Adds an
outcomes field carrying measured results, revision counts, and the failures
that drove them, which is the evidence a reader is looking for."
```

---

## Verification Summary

After every task, the following must hold. From Task 11 onward, all three commands exist:

```bash
npx pnpm@latest typecheck   # exit 0    (available from Task 10)
npx pnpm@latest test        # exit 0    (available from Task 11)
npx pnpm@latest build       # exit 0    (available throughout)
```

**Final acceptance for the whole plan:**

1. `grep -rn "cdnjs\|jsdelivr\|unpkg" public/ src/` returns nothing.
2. axe DevTools reports zero critical or serious violations on all six sections and all five modals, in **both** themes.
3. `document.querySelectorAll("h1").length === 1` on the portfolio view.
4. Tab from page load reveals a working skip link.
5. `components/ui/` contains exactly five files.
6. CI runs `typecheck` and `test` before `build`, and a deliberate type error or failing test fails the job.
7. `du -sh public/portfolio/assets/media` is under 5 MB.
8. All six CircuitTrace IC blocks still render at 1440px, and `tests/circuit-geometry.test.ts` passes.
9. All ten modal transitions in Task 17 Step 3 behave as listed.
10. `npx pnpm@latest preview` renders the site with no console errors and no third-party network requests.
