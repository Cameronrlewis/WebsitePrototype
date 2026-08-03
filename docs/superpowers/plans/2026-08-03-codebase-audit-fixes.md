# Codebase Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 22 findings from the 2026-08-03 codebase audit (`docs/superpowers/plans/../../../` audit artifact) — 2 High, 6 Medium, 4 Low severity issues, plus the testing/CI/performance gaps the audit identified as missing entirely.

**Architecture:** No structural rewrite. Fixes are surgical: config/text corrections, dead-code removal, a documentation-drift correction, a new type-check/CI safety net, a new (currently nonexistent) test suite seeded with the five highest-value tests, and one large-file decomposition (`CircuitTrace.tsx`) done via pure-function extraction with no behavior change.

**Tech Stack:** Vite 6.3.5, React 18.3.1, TypeScript, Tailwind CSS 4, pnpm, Vitest (new), Playwright (new), GitHub Actions (new).

## Global Constraints

- Package manager is **pnpm**; do not introduce npm/yarn lockfiles.
- `vite` is pinned to `6.3.5` and `rollup` is aliased to `@rollup/wasm-node` — never unpin these casually (native-rollup build break, documented in `CLAUDE.md`).
- No em dashes (`—`) in `src/app/src/app/data/portfolio.ts` content — standing content rule.
- Real app source lives under `src/app/src/app/`; do not edit the stale duplicate at root `src/styles/`.
- `CircuitTrace.tsx` measures `[data-section]` DOM geometry at runtime — any extraction must preserve exact runtime behavior; do not touch section spacing (`space-y-16 lg:space-y-24`) or `<main>` layout as a side effect of this work.
- No destructive git operations (force-push, hard reset, deleting `.claude/worktrees/*`) without explicit user confirmation at the point specified in Task 16.
- Every task must leave `pnpm build` green before moving to the next task.

---

### Task 1: Fix robots.txt sitemap domain

**Files:**
- Modify: `public/robots.txt`

**Interfaces:** None — standalone text fix.

- [ ] **Step 1: Confirm the current wrong value**

```bash
cat public/robots.txt
```
Expected output includes: `Sitemap: https://cameronlewis.dev/sitemap.xml`

- [ ] **Step 2: Fix the domain**

Edit `public/robots.txt` so its full contents read exactly:

```
User-agent: *
Allow: /

Sitemap: https://cameron-lewis.com/sitemap.xml
```

- [ ] **Step 3: Verify**

```bash
cat public/robots.txt
```
Expected: `Sitemap: https://cameron-lewis.com/sitemap.xml`

- [ ] **Step 4: Commit**

```bash
git add public/robots.txt
git commit -m "fix(seo): correct robots.txt sitemap domain"
```

---

### Task 2: Fix the silently-broken pnpm/rollup version pin

**Files:**
- Modify: `package.json:64-69` (the `"pnpm"` field)
- Create/Modify: `pnpm-workspace.yaml`
- Modify: `CLAUDE.md` (update the pin-mechanism note)

**Interfaces:** None — build-tooling config only.

**Context:** `package.json` currently pins rollup/vite via a `"pnpm"` top-level field:

```json
"pnpm": {
  "overrides": {
    "vite": "6.3.5",
    "rollup": "npm:@rollup/wasm-node@4.60.2"
  }
}
```

Modern pnpm no longer reads `package.json`'s `"pnpm"` field — it reads `pnpm-workspace.yaml` instead. Running `pnpm install` today prints:
```
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides"
```

- [ ] **Step 1: Reproduce the warning**

```bash
npx pnpm@latest install --dry-run 2>&1 | grep -i "no longer read"
```
Expected: the warning line printed above (confirms the field is currently inert).

- [ ] **Step 2: Check for an existing `pnpm-workspace.yaml`**

```bash
cat pnpm-workspace.yaml 2>/dev/null || echo "NOT PRESENT"
```

- [ ] **Step 3: Move the override into `pnpm-workspace.yaml`**

If the file doesn't exist, create `pnpm-workspace.yaml` with:

```yaml
packages:
  - "."

overrides:
  vite: "6.3.5"
  rollup: "npm:@rollup/wasm-node@4.60.2"
```

If it already exists (e.g. just a `packages:` list), add the `overrides:` block to it without removing existing keys.

- [ ] **Step 4: Remove the now-dead `"pnpm"` field from `package.json`**

Delete this block from `package.json`:

```json
,
  "pnpm": {
    "overrides": {
      "vite": "6.3.5",
      "rollup": "npm:@rollup/wasm-node@4.60.2"
    }
  }
```

so the file ends with the `devDependencies` block and a closing `}`.

- [ ] **Step 5: Reinstall and verify the pin actually takes effect**

```bash
env npm_config_cache=/private/tmp/npm-cache npx pnpm@latest install 2>&1 | tee /tmp/pnpm-install.log
grep -i "no longer read" /tmp/pnpm-install.log && echo "STILL BROKEN" || echo "WARNING GONE"
node -e "console.log(require('./node_modules/vite/package.json').version)"
node -e "console.log(require('./node_modules/rollup/package.json').version)"
```
Expected: "WARNING GONE"; vite version `6.3.5`; rollup version resolves to the `@rollup/wasm-node` package (check its `name` field too: `node -e "console.log(require('./node_modules/rollup/package.json').name)"` should print `@rollup/wasm-node`).

- [ ] **Step 6: Verify the build still works with the migrated pin**

```bash
pnpm build
```
Expected: build succeeds, same output as before (main chunk, `ResumeViewer` chunk, `pdf.worker` chunk).

- [ ] **Step 7: Update `CLAUDE.md`'s pin documentation**

In `CLAUDE.md`, find the paragraph starting `**Rollup/Vite pinning.**` and replace the sentence `` `package.json` `pnpm.overrides` pins `vite` to `6.3.5`... `` with:

```
`pnpm-workspace.yaml`'s `overrides` block pins `vite` to `6.3.5` and aliases `rollup` → `@rollup/wasm-node` (the WASM build) to dodge the native-binary issue; `tools/patch-rollup-native.mjs` (postinstall) reinforces this. Don't bump Vite or unpin rollup casually — the build depends on this workaround. (Migrated off `package.json`'s `pnpm.overrides` field in 2026-08 after modern pnpm stopped reading it.)
```

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml CLAUDE.md
git commit -m "fix(build): migrate vite/rollup pin to pnpm-workspace.yaml"
```

---

### Task 3: Fix stale README contact-form description

**Files:**
- Modify: `README.md`

**Interfaces:** None.

**Context:** `README.md:85` currently says "The contact form is local prototype behavior only. It does not submit to a backend service." but `Contact.tsx` no longer has a form — it's a pinout-diagram of copy-to-clipboard/mailto/social links (per commit `b710699 Rework contact section, trim labels, align AC IN flag`).

- [ ] **Step 1: Locate the stale line**

```bash
grep -n "contact form" README.md
```
Expected: line 85, `The contact form is local prototype behavior only. It does not submit to a backend service.`

- [ ] **Step 2: Read `Contact.tsx` to confirm current behavior**

```bash
sed -n '1,40p' src/app/src/app/components/Contact.tsx
```
Confirm it exposes copy-to-clipboard, `mailto:`, and social links — no `<form>` element.

- [ ] **Step 3: Replace the stale line**

Replace:
```
The contact form is local prototype behavior only. It does not submit to a backend service.
```
with:
```
The Contact section is a static "pinout diagram" of direct links — email (copy-to-clipboard + `mailto:`), LinkedIn, GitHub, and a resume download. There is no form and nothing submits to a backend.
```

- [ ] **Step 4: Verify**

```bash
grep -n "pinout diagram" README.md
```
Expected: the new line present.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: fix stale contact-form description in README"
```

---

### Task 4: Add skip-to-content link

**Files:**
- Modify: `src/app/src/app/components/Layout.tsx`
- Modify: `src/app/src/styles/globals.css`

**Interfaces:**
- Consumes: `Layout.tsx`'s existing `<main>` element (currently unlabeled by `id`).
- Produces: `#main-content` id target usable by any future in-page anchor.

**Context:** `Layout.tsx:276` renders `<main>` with no `id`, and there is no bypass link before the `Sidebar`, so keyboard users must tab through the full nav before reaching content (WCAG 2.4.1).

- [ ] **Step 1: Find the current `<main>` and `Sidebar` render order**

```bash
grep -n "<Sidebar\|<main" src/app/src/app/components/Layout.tsx
```

- [ ] **Step 2: Add the skip link CSS**

In `src/app/src/styles/globals.css`, add (near the top, alongside other base/utility rules):

```css
.skip-link {
  position: absolute;
  top: -3rem;
  left: 1rem;
  z-index: 100;
  background: var(--surface-1);
  color: var(--text-strong);
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--outline-strong);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.15s ease;
}

.skip-link:focus {
  top: 1rem;
}
```

- [ ] **Step 3: Render the skip link as the first focusable element**

In `Layout.tsx`, find the component's top-level return (the element that wraps `Sidebar` and `<main>`) and add the skip link immediately before `<Sidebar`:

```tsx
<a href="#main-content" className="skip-link">
  Skip to content
</a>
```

- [ ] **Step 4: Add the `id` target to `<main>`**

Find the `<main>` element (around line 276) and add `id="main-content"` to its existing prop list, e.g.:

```tsx
<main ref={mainRef} id="main-content" className={...existing classes...}>
```

- [ ] **Step 5: Manual keyboard test**

```bash
pnpm dev
```
In the browser: load the page, press `Tab` once. Expected: the "Skip to content" link becomes visible and focused. Press `Enter`. Expected: focus moves to `<main>` and the visible skip link disappears again. Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/components/Layout.tsx src/app/src/styles/globals.css
git commit -m "feat(a11y): add skip-to-content link"
```

---

### Task 5: Consolidate duplicated theme-bootstrap logic

**Files:**
- Create: `src/app/src/app/lib/theme-bootstrap.ts`
- Modify: `src/main.tsx`
- Modify: `src/app/src/app/components/ThemeProvider.tsx`

**Interfaces:**
- Produces: `THEME_STORAGE_KEY: string`, `resolveInitialTheme(): "light" | "dark"`, both exported from `src/app/src/app/lib/theme-bootstrap.ts`.
- Consumed by: `src/main.tsx` (pre-render flash guard) and `ThemeProvider.tsx` (runtime theme state).

**Context:** `src/main.tsx:5-13` and `ThemeProvider.tsx:24-33` (`resolveInitialTheme()`) independently reimplement the same `localStorage`/`matchMedia` resolution logic, including the duplicated string literal `"portfolio-theme"`.

- [ ] **Step 1: Read both current implementations**

```bash
sed -n '1,20p' src/main.tsx
sed -n '1,40p' src/app/src/app/components/ThemeProvider.tsx
```

- [ ] **Step 2: Create the shared module**

Create `src/app/src/app/lib/theme-bootstrap.ts`:

```ts
export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "portfolio-theme";

export function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

- [ ] **Step 3: Update `src/main.tsx` to use it**

Replace:

```ts
const themeStorageKey = "portfolio-theme";
const savedTheme = window.localStorage.getItem(themeStorageKey);
const initialTheme =
  savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
```

with:

```ts
import { resolveInitialTheme } from "./app/src/app/lib/theme-bootstrap";

const initialTheme = resolveInitialTheme();
```

(Place the new `import` alongside the existing `import App from "./app/src/app/App.tsx";` line at the top of the file.)

- [ ] **Step 4: Update `ThemeProvider.tsx` to use it**

Replace the local `STORAGE_KEY` constant and `resolveInitialTheme()` function in `ThemeProvider.tsx` with:

```ts
import { THEME_STORAGE_KEY, resolveInitialTheme, type ThemeMode } from "../lib/theme-bootstrap";
```

Remove the file's own `export type ThemeMode = "light" | "dark";`, `const STORAGE_KEY = "portfolio-theme";`, and `function resolveInitialTheme(): ThemeMode { ... }` — all uses of `STORAGE_KEY` elsewhere in the file (e.g. `window.localStorage.setItem(STORAGE_KEY, ...)`) become `THEME_STORAGE_KEY`.

- [ ] **Step 5: Verify no leftover references to the old local names**

```bash
grep -n "STORAGE_KEY\b" src/app/src/app/components/ThemeProvider.tsx
```
Expected: every match reads `THEME_STORAGE_KEY`, none reads a bare `STORAGE_KEY` declaration.

- [ ] **Step 6: Build and manually verify theme persistence**

```bash
pnpm build
pnpm dev
```
In the browser: toggle the theme, reload the page. Expected: theme persists (no flash of wrong theme). Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/app/src/app/components/ThemeProvider.tsx src/app/src/app/lib/theme-bootstrap.ts
git commit -m "refactor: consolidate duplicated theme-bootstrap logic"
```

---

### Task 6: Reconcile the missing rebuild-board-geometry skill reference

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None.

**Context:** `CLAUDE.md` states both `optimize-media` and `rebuild-board-geometry` skills exist under `.claude/skills/`, but only `optimize-media/` is present in this checkout. The actual geometry-build entry point is `tools/build-board-geometry-bin.mjs` (invoked via `pnpm build:geometry`).

- [ ] **Step 1: Confirm the skill is actually absent**

```bash
ls .claude/skills/
```
Expected: only `optimize-media` (no `rebuild-board-geometry`).

- [ ] **Step 2: Confirm the real geometry-build entry point**

```bash
cat package.json | grep "build:geometry"
ls tools/build-board-geometry-bin.mjs
```

- [ ] **Step 3: Update `CLAUDE.md`**

Find the sentence: `` **Project media** (image optimization pipeline) and **board geometry** (regenerating `.pcbgeo` viewer assets) each have a dedicated skill under `.claude/skills/` — see `optimize-media` and `rebuild-board-geometry` before touching `assets-src/media-originals/` or `assets-src/board-geometry/`. ``

Replace with:

```
**Project media** (image optimization pipeline) has a dedicated skill under `.claude/skills/optimize-media` — see it before touching `assets-src/media-originals/`. **Board geometry** (regenerating `.pcbgeo` viewer assets) has no dedicated skill in this checkout — run `pnpm build:geometry` (wraps `tools/build-board-geometry-bin.mjs`) directly before touching `assets-src/board-geometry/`.
```

- [ ] **Step 4: Verify**

```bash
grep -n "rebuild-board-geometry" CLAUDE.md
```
Expected: no output (reference fully removed).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct stale rebuild-board-geometry skill reference"
```

---

### Task 7: Add TypeScript type-checking

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Modify: `package.json` (add `typecheck` script and `typescript` devDependency)

**Interfaces:**
- Produces: `pnpm typecheck` script, runnable standalone and by CI (Task 8).

**Context:** No `tsconfig.json` exists today; `vite build` does not type-check, so type errors ship silently. This task adds the config and script only — it does not yet fail the build on errors (that's Task 8's CI gate), and any errors it surfaces are triaged in Step 5 without scope-creeping into unrelated refactors.

- [ ] **Step 1: Confirm no tsconfig exists**

```bash
ls tsconfig*.json 2>/dev/null || echo "NONE PRESENT"
```

- [ ] **Step 2: Add the `typescript` devDependency**

```bash
pnpm add -D typescript@5.7.3
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`** (covers `vite.config.ts` and `tools/*.mjs` tooling)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Add the `typecheck` script**

In `package.json`, add to `"scripts"`:

```json
"typecheck": "tsc --build --force"
```

- [ ] **Step 6: Run it and record what surfaces**

```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck-baseline.log
wc -l /tmp/typecheck-baseline.log
```

- [ ] **Step 7: Triage the baseline**

If `/tmp/typecheck-baseline.log` is empty (no errors): skip to Step 8.

If errors are present: for each **distinct error message** (not each occurrence), open the referenced file:line and classify it as either (a) a genuine type bug worth fixing now, or (b) a pre-existing pattern too broad to fix as part of this task (e.g. a systemic `any` usage across many files). Fix every (a) inline, in this same task, with a real code change and a re-run of `pnpm typecheck` after each fix to confirm it's resolved. For every (b), do not fix it here — instead add a one-line comment above the exact line documenting it as a known pre-existing issue, e.g. `// TODO(typecheck): <error text>, pre-existing, out of scope for audit fix — see docs/superpowers/plans/2026-08-03-codebase-audit-fixes.md Task 7`, and list it in the commit message body under a "Known pre-existing type errors (documented, not fixed)" heading.

- [ ] **Step 8: Confirm final state**

```bash
pnpm typecheck
echo "exit code: $?"
```
Record whether the command now exits `0` or non-zero — this determines whether Task 8's CI gate can require it (exit 0) or must run it non-blocking (non-zero, until the documented pre-existing errors are cleared in a future pass).

- [ ] **Step 9: Commit**

```bash
git add tsconfig.json tsconfig.node.json package.json pnpm-lock.yaml
git commit -m "feat(dx): add tsconfig.json and pnpm typecheck script"
```

---

### Task 8: Add a minimal CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm build` (existing script), `pnpm typecheck` (from Task 7).
- Produces: a required GitHub Actions check named `build-and-typecheck` that Task 13 later extends with the test suite.

- [ ] **Step 1: Confirm no workflow exists**

```bash
ls .github/workflows/ 2>/dev/null || echo "NONE PRESENT"
```

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/ci.yml`. Use `continue-on-error` on the typecheck step only if Task 7 Step 8 found the command exits non-zero (pre-existing documented errors); otherwise omit it so typecheck is a hard gate:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Build
        run: pnpm build
```

- [ ] **Step 3: Validate the YAML syntax locally**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "VALID YAML"
```

- [ ] **Step 4: Commit and push to trigger a real run**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build and typecheck workflow"
```

Note: pushing to a branch and opening a PR (or pushing to `main` if that's the team's flow) is required to see the workflow actually execute on GitHub's runners — this cannot be verified further from the local sandbox. Confirm the first run manually via `gh run list --workflow=ci.yml` or the GitHub UI after pushing.

---

### Task 9: Remove unused shadcn UI scaffold and matching dependencies

**Files:**
- Delete: 41 files under `src/app/src/app/components/ui/` (see exact list in Step 2)
- Modify: `package.json` (remove unused dependencies)

**Interfaces:**
- Consumes: nothing new.
- Preserves: `src/app/src/app/components/ui/button.tsx`, `badge.tsx`, `dialog.tsx`, `utils.ts` — the only four files any app code imports.

**Context:** Verified by grep: only `button`, `badge`, `dialog`, and `utils` (imported as `from "./ui/..."`) are referenced anywhere in `src/app/src/app`. `use-mobile.ts` is imported only by the unused `ui/sidebar.tsx`, so it is dead too. The following npm packages are dependencies only of these dead files: `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `cmdk`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `vaul`.

- [ ] **Step 1: Re-verify the import graph before deleting anything (catch drift since the audit)**

```bash
grep -rn 'from "\./ui/' src/app/src/app --include="*.tsx" --include="*.ts" | sed -E 's/.*ui\///' | sort -u
grep -rln "use-mobile" src/app/src/app --include="*.tsx" --include="*.ts"
```
Expected first command: only `badge";`, `button";`, `dialog";`, `utils";`. Expected second command: only `src/app/src/app/components/ui/sidebar.tsx`.

If either output differs from expected (i.e. some other file now imports something new from `ui/`), **stop this task** and re-derive the keep-list from the new grep output before proceeding — do not delete a file with a live import.

- [ ] **Step 2: Delete the unused UI scaffold files**

```bash
cd src/app/src/app/components/ui
rm -f accordion.tsx alert-dialog.tsx alert.tsx aspect-ratio.tsx avatar.tsx breadcrumb.tsx \
  calendar.tsx card.tsx carousel.tsx chart.tsx checkbox.tsx collapsible.tsx command.tsx \
  context-menu.tsx drawer.tsx dropdown-menu.tsx form.tsx hover-card.tsx input-otp.tsx \
  input.tsx label.tsx menubar.tsx navigation-menu.tsx pagination.tsx popover.tsx \
  progress.tsx radio-group.tsx resizable.tsx scroll-area.tsx select.tsx separator.tsx \
  sheet.tsx sidebar.tsx skeleton.tsx slider.tsx sonner.tsx switch.tsx table.tsx tabs.tsx \
  textarea.tsx toggle-group.tsx toggle.tsx tooltip.tsx use-mobile.ts
cd -
ls src/app/src/app/components/ui/
```
Expected final listing: exactly `badge.tsx`, `button.tsx`, `dialog.tsx`, `utils.ts`.

- [ ] **Step 3: Remove the matching dependencies from `package.json`**

```bash
pnpm remove @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio \
  @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible \
  @radix-ui/react-context-menu @radix-ui/react-dropdown-menu @radix-ui/react-hover-card \
  @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu \
  @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator \
  @radix-ui/react-slider @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toggle \
  @radix-ui/react-toggle-group @radix-ui/react-tooltip cmdk embla-carousel-react input-otp \
  next-themes react-day-picker react-hook-form react-resizable-panels recharts sonner vaul
```

- [ ] **Step 4: Confirm the kept files' dependencies are still declared**

```bash
grep -n '"@radix-ui/react-slot"\|"@radix-ui/react-dialog"\|"class-variance-authority"\|"clsx"\|"tailwind-merge"\|"lucide-react"' package.json
```
Expected: all five still present (these back `button.tsx`, `badge.tsx`, `dialog.tsx`, `utils.ts`).

- [ ] **Step 5: Type-check and build**

```bash
pnpm typecheck
pnpm build
```
Expected: both succeed with no new errors referencing a deleted `ui/*` file.

- [ ] **Step 6: Compare bundle size before/after (informational — expected to be roughly unchanged since unused imports were already tree-shaken)**

```bash
du -sh dist/assets/*.js
```
Record the sizes; compare against the pre-deletion build output noted in the audit (`index-*.js` 545.51 kB / 164.20 kB gzip). Note the result in the commit message — do not treat a small delta as a bug.

- [ ] **Step 7: Commit**

```bash
git add -A src/app/src/app/components/ui package.json pnpm-lock.yaml
git commit -m "chore: remove unused shadcn UI scaffold and dependencies"
```

---

### Task 10: Sweep em dashes out of portfolio.ts

**Files:**
- Modify: `src/app/src/app/data/portfolio.ts`

**Interfaces:** None — content-only edit; no exported shape changes.

**Context:** 34 em-dash (`—`) occurrences exist across three patterns, each needing different replacement punctuation (no single find/replace is correct for all of them):

1. **Date ranges** (`"January 2026 — April 2026"`, `"Jun 2026 — Present"`, `"2024 — Present"`) → replace with an en dash and no surrounding spaces: `"January 2026–April 2026"`.
2. **Label/role separators** (`"Paradigm Engineering — MUN Student Design Team"`, `"Avionics — Electrical"`, `"ECE-3300 — Circuits & Electronics"`) → replace with a colon: `"Paradigm Engineering: MUN Student Design Team"`.
3. **Prose clause separators** (narrative build-log sentences) → replace with a period, splitting into two sentences.

- [ ] **Step 1: List every occurrence with line numbers**

```bash
grep -n "—" src/app/src/app/data/portfolio.ts
```

- [ ] **Step 2: Fix date-range occurrences (pattern 1)**

For each line matching `"<Month> <Year> — <Month/Present/Year>"` or `"<Year> — <Year/Present>"`, replace `" — "` with `–` (en dash, no surrounding spaces). Confirmed lines from the audit: `202`, `221`, `238`, `255`, `292`, `301`, `501`, `533`, `568`, `585`, `623`(period field only, not the `role` line — check each), `624`, `639`, `657`, `672`. For each, open the line and change e.g.:
```ts
period: "January 2026 — April 2026",
```
to:
```ts
period: "January 2026–April 2026",
```
Apply the same transform to every `period:` field containing `—`.

- [ ] **Step 3: Fix label/role separators (pattern 2)**

For lines `217`, `234`, `236 ("Avionics — Electrical")`, `251`, `310`–`317` (course codes), `623 ("Avionics — Electrical")`, replace `" — "` with `": "`. Example:
```ts
company: "Paradigm Engineering — MUN Student Design Team",
```
becomes:
```ts
company: "Paradigm Engineering: MUN Student Design Team",
```
and:
```ts
"ECE-3300 — Circuits & Electronics",
```
becomes:
```ts
"ECE-3300: Circuits & Electronics",
```
Apply this to all eight course-code lines (`310`–`317`) and to the `role`/`company` fields listed above.

- [ ] **Step 4: Fix the `highlights` array line 296**

```ts
highlights: ["Dean's List — 2024-2025", "3rd Place Python Project Award in Verafin Hosted Competition", "Paradigm Electrical Member"],
```
becomes (label/date pattern — colon):
```ts
highlights: ["Dean's List: 2024-2025", "3rd Place Python Project Award in Verafin Hosted Competition", "Paradigm Electrical Member"],
```

- [ ] **Step 5: Fix prose clause separators (pattern 3) — lines 592 and 606**

Line 592, replace:
```ts
"Desoldered the capacitor from both buck circuits on the board — powered it back on and both rails came up cleanly with no flashing.",
```
with:
```ts
"Desoldered the capacitor from both buck circuits on the board. Powered it back on and both rails came up cleanly with no flashing.",
```

Line 606, replace:
```ts
"Confirmed all voltage outputs on the bench, then connected the Brick Buck Board to both the 20 Ah and 50 Ah competition batteries — it worked perfectly on both. Later in the week the team moved into full autonomous kart testing with computer vision for track time, and the board passed with no issues throughout.",
```
with:
```ts
"Confirmed all voltage outputs on the bench, then connected the Brick Buck Board to both the 20 Ah and 50 Ah competition batteries. It worked perfectly on both. Later in the week the team moved into full autonomous kart testing with computer vision for track time, and the board passed with no issues throughout.",
```

- [ ] **Step 6: Verify every em dash is gone**

```bash
grep -n "—" src/app/src/app/data/portfolio.ts
echo "exit code: $?"
```
Expected: no output, exit code `1` (grep found nothing).

- [ ] **Step 7: Build and visually spot-check rendered dates**

```bash
pnpm build
pnpm dev
```
In the browser, check Experience and Education sections render date ranges (`"January 2026–April 2026"` etc.) legibly — the en dash should not look like a stray hyphen typo. Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add src/app/src/app/data/portfolio.ts
git commit -m "content: remove em dashes from portfolio.ts per style rule"
```

---

### Task 11: Add Vitest and unit-test `parseHash` and `copyText`

**Files:**
- Create: `vitest.config.ts`
- Create: `src/app/src/app/components/Layout.test.ts`
- Create: `src/app/src/app/components/Contact.test.ts`
- Modify: `src/app/src/app/components/Layout.tsx` (export `parseHash` for testing)
- Modify: `src/app/src/app/components/Contact.tsx` (export `copyText` for testing)
- Modify: `package.json` (add `test` script and devDependencies)

**Interfaces:**
- Consumes: `parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null }` (existing, currently module-private in `Layout.tsx`).
- Consumes: `copyText(text: string): Promise<boolean>` (existing, currently module-private in `Contact.tsx` — confirm exact name/signature in Step 1 before writing tests; adjust the test to match if it differs).
- Produces: `pnpm test` script for Task 13's CI wiring.

- [ ] **Step 1: Confirm the exact current signatures**

```bash
grep -n "^function parseHash\|^function copyText\|^async function copyText" src/app/src/app/components/Layout.tsx src/app/src/app/components/Contact.tsx
```
Read the surrounding ~20 lines of whichever function(s) are found and adjust Steps 4/7 below if the real signature differs from what's assumed above — the assumed signatures come from the audit summary, not a fresh read at plan-writing time.

- [ ] **Step 2: Add Vitest**

```bash
pnpm add -D vitest@2.1.8
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Export `parseHash` from `Layout.tsx`**

Change:
```ts
function parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null } {
```
to:
```ts
export function parseHash(hash: string): { view: ViewId; section: SectionId; project: ProjectRecord | null } {
```

- [ ] **Step 5: Write the failing test for `parseHash`**

Create `src/app/src/app/components/Layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseHash } from "./Layout";

describe("parseHash", () => {
  it("defaults to home when hash is empty", () => {
    expect(parseHash("")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("routes #/updates to the updates view", () => {
    expect(parseHash("#/updates")).toEqual({ view: "updates", section: "home", project: null });
  });

  it("routes a known section id to the portfolio view", () => {
    expect(parseHash("#/education")).toEqual({ view: "portfolio", section: "education", project: null });
  });

  it("falls back to home for an unknown section id", () => {
    expect(parseHash("#/not-a-real-section")).toEqual({ view: "portfolio", section: "home", project: null });
  });

  it("falls back to home for a project slug that doesn't exist", () => {
    expect(parseHash("#/projects/not-a-real-slug")).toEqual({ view: "portfolio", section: "home", project: null });
  });
});
```

- [ ] **Step 6: Run it and verify it passes (or fails informatively if a real project slug is needed)**

```bash
pnpm exec vitest run src/app/src/app/components/Layout.test.ts
```
Expected: all 5 tests pass. If the "unknown section id" or "unknown project slug" cases don't fall back to `home` as expected, re-read `parseHash`'s actual fallback logic (shown in the audit's Phase 1 read) and correct the test's expectation to match real behavior — do not change the source to match a wrong test guess.

- [ ] **Step 7: Export `copyText` from `Contact.tsx`**

Using the exact function found in Step 1, add `export` to its declaration if not already exported.

- [ ] **Step 8: Write the failing test for `copyText`**

Create `src/app/src/app/components/Contact.test.ts`. Adjust the mock setup to match `copyText`'s actual implementation confirmed in Step 1 (this assumes a Clipboard API primary path with a `document.execCommand("copy")` fallback, per the audit):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./Contact";

describe("copyText", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
    vi.restoreAllMocks();
  });

  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const result = await copyText("hello@example.com");

    expect(writeText).toHaveBeenCalledWith("hello@example.com");
    expect(result).toBe(true);
  });

  it("falls back to document.execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const result = await copyText("hello@example.com");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 9: Run it and verify it passes**

```bash
pnpm exec vitest run src/app/src/app/components/Contact.test.ts
```
Expected: both tests pass. If `copyText`'s real implementation differs (e.g. it doesn't return a boolean, or uses a different fallback), adjust the test's assertions to match the real, confirmed-in-Step-1 behavior.

- [ ] **Step 10: Add the `test` script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 11: Run the full suite**

```bash
pnpm test
```
Expected: 7 tests pass (5 `parseHash` + 2 `copyText`).

- [ ] **Step 12: Commit**

```bash
git add vitest.config.ts src/app/src/app/components/Layout.tsx src/app/src/app/components/Layout.test.ts src/app/src/app/components/Contact.tsx src/app/src/app/components/Contact.test.ts package.json pnpm-lock.yaml
git commit -m "test: add Vitest with unit tests for parseHash and copyText"
```

---

### Task 12: Add Playwright and an E2E test for project-modal / 3D-viewer state restore

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/project-modal.spec.ts`
- Modify: `package.json` (add `test:e2e` script and devDependency)

**Interfaces:**
- Consumes: the running dev server (`pnpm dev`, default port `5173`) or a `vite preview` build.
- Produces: `pnpm test:e2e` script for Task 13's CI wiring.

**Context:** Per the audit, `Layout.tsx`'s `selectedProject` / `viewerReturnProject` / `organizationReturnProject` state machine is the most complex state in the app and the most likely to regress silently. This test opens a project modal, opens its 3D viewer, closes the viewer, and asserts the project modal reappears.

- [ ] **Step 1: Identify a real project with a 3D board viewer to target**

```bash
grep -n "viewerAsset" src/app/src/app/data/portfolio.ts | head -5
```
Pick the first project slug returned (needed for the test URL in Step 4) — call it `<PROJECT_SLUG>` below, substituted with the real value found here.

- [ ] **Step 2: Add Playwright**

```bash
pnpm create playwright@1.49.1 --quiet --browser=chromium --no-examples --gha=false
```
If this scaffolds files that conflict with the manual setup below, keep its generated `package.json` script additions but replace its generated config/test files with the ones in Steps 3–4.

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

- [ ] **Step 4: Write the failing E2E test**

Create `e2e/project-modal.spec.ts`, substituting the real `<PROJECT_SLUG>` found in Step 1 and adjusting selectors to match the actual DOM once run (Step 5 may require selector corrections — this is expected for a first E2E test against unfamiliar markup):

```ts
import { test, expect } from "@playwright/test";

test("project modal reappears after closing the 3D board viewer", async ({ page }) => {
  await page.goto("/#/projects/<PROJECT_SLUG>");

  // Project modal should be open on direct deep link.
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();

  // Open the 3D board viewer from within the modal.
  await page.getByRole("button", { name: /3d|board|view/i }).first().click();

  // The board viewer should now be visible and the project modal hidden/replaced.
  const viewer = page.locator("iframe");
  await expect(viewer).toBeVisible();

  // Close the viewer.
  await page.getByRole("button", { name: /close/i }).first().click();

  // The project modal should reappear.
  await expect(modal).toBeVisible();
});
```

- [ ] **Step 5: Run it and fix selectors against real markup**

```bash
pnpm exec playwright test e2e/project-modal.spec.ts --headed
```
This will very likely fail on the first run due to selector mismatches (guessed `getByRole` names). Open `src/app/src/app/components/ProjectModal.tsx` and `src/app/src/app/components/BoardViewer.tsx`, find the actual button labels/`aria-label`s used for "open 3D viewer" and "close", and update the test's selectors to match exactly. Re-run until it passes.

- [ ] **Step 6: Add the `test:e2e` script**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 7: Confirm it passes headlessly (as CI will run it)**

```bash
pnpm test:e2e
```
Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts e2e/project-modal.spec.ts package.json pnpm-lock.yaml
git commit -m "test: add Playwright E2E test for project-modal viewer restore"
```

---

### Task 13: Wire the test suite into the CI gate

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm test` (Task 11), `pnpm test:e2e` (Task 12), `pnpm build`/`pnpm typecheck` (Task 8).

- [ ] **Step 1: Add a `unit-tests` job**

In `.github/workflows/ci.yml`, add a new job alongside `build-and-typecheck`:

```yaml
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

- [ ] **Step 2: Add an `e2e-tests` job, marked non-blocking initially (per the audit's guidance to keep E2E optional until proven non-flaky)**

```yaml
  e2e-tests:
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

- [ ] **Step 3: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "VALID YAML"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: wire unit and e2e tests into the CI gate"
```

Note: after a few real CI runs (visible via `gh run list --workflow=ci.yml`) confirm `e2e-tests` isn't flaky, then remove its `continue-on-error: true` to make it a required check — that follow-up is outside this plan's scope and should be its own small change once real run history exists.

---

### Task 14: Extract pure constants and geometry helpers from `CircuitTrace.tsx`

**Files:**
- Modify: `src/app/src/app/components/CircuitTrace.tsx`
- Create: `src/app/src/app/components/CircuitTrace.constants.ts`
- Create: `src/app/src/app/components/CircuitTrace.geometry.ts`

**Interfaces:**
- Produces: named exports from the two new files, re-imported by `CircuitTrace.tsx` under their original names so every call site inside the component is unchanged.
- Preserves: exact runtime behavior — this is a pure move, not a rewrite. No DOM-measurement or animation-loop code moves.

**Context:** `CircuitTrace.tsx` is 2,815 lines, by far the largest file in the app. Per the audit, some pieces are genuinely separable without touching React state or refs: the `centerpieceQueue`/`netFlags`/`stage`-machine constants, and pure coordinate-math helper functions.

- [ ] **Step 1: Read the full file to identify exact extraction candidates**

```bash
wc -l src/app/src/app/components/CircuitTrace.tsx
grep -n "^const centerpieceQueue\|^const netFlags\|^function \|^const stage" src/app/src/app/components/CircuitTrace.tsx
```
For each `function`/`const` found, check whether its body references `useState`, `useRef`, `useEffect`, or any React hook, or reads from a ref/DOM element. If it does, it is **not** a candidate — leave it in the component. Build the actual extraction list from this output; the two illustrative examples below (`centerpieceQueue`, a coordinate helper) are confirmed extraction-safe per the audit's read but the full list must be derived from this step's real grep output, not assumed complete from the audit alone.

- [ ] **Step 2: Create `CircuitTrace.constants.ts`**

Move every top-level `const` identified in Step 1 that is a plain data value (arrays/objects/primitives with no function calls to browser/React APIs) into this file, each as a named export, preserving its exact original value and type. Example shape (fill in with the real constants found):

```ts
export const centerpieceQueue = [/* ...exact original array contents... */] as const;

export const netFlags = {/* ...exact original object contents... */};
```

- [ ] **Step 3: Create `CircuitTrace.geometry.ts`**

Move every pure function identified in Step 1 (no hooks, no DOM reads, only math on its own parameters) into this file as a named export, preserving its exact original implementation. Example shape:

```ts
export function /* exact original function name and signature */(/* ...params... */) {
  // ...exact original body, unchanged...
}
```

- [ ] **Step 4: Update `CircuitTrace.tsx` to import from the new files**

Remove the moved declarations from `CircuitTrace.tsx` and add imports at the top of the file:

```ts
import { centerpieceQueue, netFlags } from "./CircuitTrace.constants";
import { /* ...moved function names... */ } from "./CircuitTrace.geometry";
```

(Use the real names found in Steps 2–3, not the illustrative ones above.)

- [ ] **Step 5: Type-check**

```bash
pnpm typecheck
```
Expected: no new errors.

- [ ] **Step 6: Build**

```bash
pnpm build
```
Expected: succeeds.

- [ ] **Step 7: Manual visual regression check (no automated visual diff tool exists yet, per the audit)**

```bash
pnpm dev
```
In the browser: scroll through all six sections. Expected: the animated PCB trace (rails, IC blocks, net-flag colors) renders identically to before this change — same block placement, same colors, same animation timing. Compare against a screenshot taken before Step 1 if available, or against the live production site (`cameron-lewis.com`) side by side. Stop the dev server when done.

- [ ] **Step 8: Run the existing unit/E2E suites to catch any regression in the state machine surrounding CircuitTrace's placement**

```bash
pnpm test
pnpm test:e2e
```
Expected: all passing (these don't directly cover CircuitTrace, but confirm nothing else broke).

- [ ] **Step 9: Commit**

```bash
git add src/app/src/app/components/CircuitTrace.tsx src/app/src/app/components/CircuitTrace.constants.ts src/app/src/app/components/CircuitTrace.geometry.ts
git commit -m "refactor: extract pure constants and geometry helpers from CircuitTrace.tsx"
```

---

### Task 15: Document and run the performance validation plan

**Files:**
- Create: `docs/superpowers/plans/2026-08-03-performance-validation-results.md`

**Interfaces:** None — this task produces a findings document and a go/no-go decision for `manualChunks`, it does not blindly apply a bundle-splitting change.

**Context:** The audit's `manualChunks` recommendation (B20) is explicitly conditional on B19 (real browser measurement) showing the 545 kB main chunk is an actual bottleneck — this task performs that measurement rather than applying the optimization speculatively.

- [ ] **Step 1: Build and serve the production bundle locally**

```bash
pnpm build
pnpm preview --port 4173 &
sleep 2
```

- [ ] **Step 2: Run Lighthouse against it**

```bash
npx -y lighthouse http://localhost:4173 --output=json --output-path=/tmp/lighthouse-report.json --chrome-flags="--headless" --only-categories=performance
```

- [ ] **Step 3: Extract the key metrics**

```bash
python3 -c "
import json
data = json.load(open('/tmp/lighthouse-report.json'))
audits = data['audits']
print('LCP:', audits['largest-contentful-paint']['displayValue'])
print('CLS:', audits['cumulative-layout-shift']['displayValue'])
print('TBT:', audits['total-blocking-time']['displayValue'])
print('Performance score:', data['categories']['performance']['score'])
"
```

- [ ] **Step 4: Stop the preview server**

```bash
kill %1
```

- [ ] **Step 5: Write the results and decision to a findings doc**

Create `docs/superpowers/plans/2026-08-03-performance-validation-results.md` with the actual measured values from Step 3 filled in:

```markdown
# Performance Validation Results — 2026-08-03

Measured via Lighthouse against a local `vite preview` of the production build (post Task 9's dependency cleanup).

| Metric | Value |
|---|---|
| LCP | <fill in from Step 3> |
| CLS | <fill in from Step 3> |
| TBT | <fill in from Step 3> |
| Performance score | <fill in from Step 3> |

## Decision: manualChunks split

- If TBT is elevated (>200ms) or the performance score is below 90 **and** the main chunk (545 kB / 164 kB gzip) is flagged by Lighthouse's "Reduce JavaScript execution time" or "Minimize main-thread work" audits as a contributor: implement a `manualChunks` split in `vite.config.ts` separating vendor code (React, Radix, motion) from app code, then re-run this measurement to confirm improvement.
- If not: no action — do not add `manualChunks` speculatively. Record that decision here with the measured numbers as justification.

**Caveat:** this is a local, unthrottled measurement — it does not replace a real-network/real-device Lighthouse run against the deployed `cameron-lewis.com`, which needs the live URL and is out of scope for a local sandbox.
```

- [ ] **Step 6: If Step 5's decision is "implement manualChunks", do so now; otherwise skip to Step 8**

If implementing, add to `vite.config.ts`:

```ts
export default defineConfig({
  // ...existing config...
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          motion: ["motion"],
        },
      },
    },
  },
})
```

- [ ] **Step 7: Rebuild and re-measure (only if Step 6 was performed)**

```bash
pnpm build
pnpm preview --port 4173 &
sleep 2
npx -y lighthouse http://localhost:4173 --output=json --output-path=/tmp/lighthouse-report-after.json --chrome-flags="--headless" --only-categories=performance
kill %1
```
Append the "after" numbers to the findings doc under a new "Post-manualChunks" table.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-08-03-performance-validation-results.md vite.config.ts
git commit -m "perf: measure production LCP/CLS/TBT and document manualChunks decision"
```

---

### Task 16: Resolve the stale `.claude/worktrees/*` checkouts (requires user decision)

**Files:**
- Delete (conditionally): `.claude/worktrees/contact-redesign-cleanup/`, `.claude/worktrees/zealous-visvesvaraya-c4ddc9/`

**Interfaces:** None.

**Context:** Two full duplicate source-tree checkouts exist under `.claude/worktrees/`. This is a destructive operation on directories whose purpose was not confirmed during the audit — per this plan's global constraints, it requires explicit user confirmation before deletion.

- [ ] **Step 1: Inspect what's actually in each worktree**

```bash
cd .claude/worktrees/contact-redesign-cleanup && git status && git log --oneline -5 && cd -
cd .claude/worktrees/zealous-visvesvaraya-c4ddc9 && git status && git log --oneline -5 && cd -
```

- [ ] **Step 2: Compare each worktree's branch against `main`**

```bash
cd .claude/worktrees/contact-redesign-cleanup && git log main..HEAD --oneline && cd -
cd .claude/worktrees/zealous-visvesvaraya-c4ddc9 && git log main..HEAD --oneline && cd -
```
If either shows commits not on `main`, that worktree holds unmerged work — do not delete it without the user reviewing those commits first.

- [ ] **Step 3: STOP — present findings to the user and ask explicitly**

Do not proceed past this step autonomously. Report to the user: what each worktree contains (from Steps 1–2), whether either holds unmerged commits, and ask: "Delete both worktrees, delete only the ones with no unmerged commits, or keep both?" Wait for an explicit answer.

- [ ] **Step 4: Remove only the worktree(s) the user confirmed, using `git worktree remove` (not raw `rm -rf`, so git's own metadata stays consistent)**

```bash
git worktree list
git worktree remove .claude/worktrees/<confirmed-name>
```

- [ ] **Step 5: Verify**

```bash
git worktree list
ls .claude/worktrees/ 2>/dev/null || echo "directory gone"
```

- [ ] **Step 6: Commit if `git worktree remove` left any tracked metadata changes**

```bash
git status
git add -A
git commit -m "chore: remove stale worktree checkout(s) per user confirmation" # only if there's something to commit
```

---

### Task 17: Strengthen weak project descriptions in portfolio.ts

**Files:**
- Modify: `src/app/src/app/data/portfolio.ts`

**Interfaces:** None — content-only edit.

**Context:** The audit found `portfolio.ts:606`'s build-log entry (bench-testing the Brick Buck Board on 20 Ah/50 Ah batteries, concrete pass/fail outcome) is a model of specific, credible technical writing. Not every entry was sampled during the audit, so this task starts with a full read to find entries that are comparatively generic, then rewrites them to match the specific, evidence-based style — without inventing facts not already present elsewhere in the file or supportable by the project's own data (e.g. BOM files, viewer assets).

- [ ] **Step 1: Read every `builds` entry across all organizations in full**

```bash
grep -n '"builds"\|description:\|"title":' src/app/src/app/data/portfolio.ts
```
Read the full surrounding text of each entry found (not just the grep line) to judge tone and specificity.

- [ ] **Step 2: Identify entries that are generic (no concrete outcome, measurement, or evidence) vs. specific (like line 606's battery test)**

For each build-log/description entry read in Step 1, classify it. Write the list of file:line + a one-sentence reason for each classified "generic" — do not skip this triage step by assuming which ones need work.

- [ ] **Step 3: For each entry classified generic in Step 2, rewrite it using only facts already present elsewhere in the same project's data (its `viewerAsset`, other builds in the same organization, dates, board names) — do not fabricate test results, numbers, or outcomes that aren't already documented somewhere in the file or in `public/portfolio/assets/` for that project**

Apply each rewrite as an edit to the exact line(s) found in Step 1, one at a time, re-reading the surrounding object literal each time to keep the edit syntactically valid (matching quote style, trailing comma, etc. of the surrounding array).

- [ ] **Step 4: Re-run the em-dash check (Task 10 may have already covered this file, but new prose written in Step 3 could reintroduce one)**

```bash
grep -n "—" src/app/src/app/data/portfolio.ts
```
Expected: no output.

- [ ] **Step 5: Build and visually spot-check the edited entries render correctly**

```bash
pnpm build
pnpm dev
```
In the browser, open each project/organization whose description was edited in Step 3 and confirm it renders without truncation or broken formatting. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/app/data/portfolio.ts
git commit -m "content: strengthen generic project descriptions with concrete detail"
```

---

## Task Order and Dependencies

Tasks 1–6 are independent and can run in any order. Task 7 must precede Task 8 (CI needs `pnpm typecheck` to exist). Task 8 must precede Task 13 (extends the same workflow file). Tasks 9 and 10 are independent of everything except each other's shared file (`portfolio.ts` for Task 10 only — no overlap with Task 9). Task 11 must precede Task 13; Task 12 must precede Task 13. Task 14 is independent but benefits from Task 7/9 landing first (fewer type/dead-code distractions while reading the file). Task 15 should run after Task 9 (bundle-size measurement should reflect the dependency cleanup). Task 16 can run any time but is gated on user input. Task 17 should run after Task 10 (avoid two separate content-editing passes touching the same file back-to-back).

Suggested sequence: 1, 2, 3, 6, 7, 8, 9, 4, 5, 10, 11, 12, 13, 14, 15, 17, 16.
