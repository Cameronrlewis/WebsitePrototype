# Codebase review — 2026-09-22

Five read-only reviewers covered the whole repository in parallel against `main` at `b113040`.
Every finding below cites a file and line, quotes the offending code, and states a concrete
failure scenario. Findings that contradicted a documented deliberate constraint in `CLAUDE.md`
were dropped by the reviewers rather than reported.

**Totals: 0 CRITICAL, 1 HIGH, 14 MEDIUM, 16 LOW.**

Sections reviewed:

| ID | Scope |
| --- | --- |
| R1 | `circuit-geometry.ts`, `CircuitTrace.tsx`, `Layout.tsx` and their tests |
| R2 | Presentational components, `ui/`, modal e2e specs |
| R3 | Board/BOM/resume viewers, `board-viewer-shell.html`, geometry tools |
| R4 | `portfolio.ts`, routing, hooks, theme, stylesheets |
| R5 | Build, config, CI, and the health of the test suite itself |

Verified clean and explicitly *not* findings: the `MIN_GAP_DEPTH` / `CENTERPIECE_SPECS` layout
contract holds (`Layout.tsx:48` is `lg:space-y-24`, all six `data-section` blocks present,
gutters intact); the iframe `postMessage` trust checks hold on both sides; Three.js resources are
disposed on unmount; every `${assetBase}` path in `portfolio.ts` resolves, including all 28
`reportPages`; no em-dashes appear in description content.

---

## HIGH

### H1 — Deploy-gating e2e runs 2 workers, so the WebGL spec starves the others
- **file:** `playwright.config.ts:14`, `e2e/board-spin.spec.ts:15`
- **evidence:** `fullyParallel: true` with no `workers` key; board-spin declares
  `test.describe.configure({ mode: "serial", timeout: 150_000 })`.
- **failure:** The repo is public, so `ubuntu-latest` gives 4 vCPU and Playwright defaults to 2
  workers — the CI log confirms "Running 26 tests using 2 workers". `mode: "serial"` only
  serializes *within* board-spin.spec.ts, so the second worker runs the modal specs alongside a
  GPU-less software-rendered WebGL scene. Scheduled run `35639397645` (job `e2e-preview`, the same
  `E2E_TARGET=preview` suite `pages.yml` runs before Upload artifact) failed its first attempt:
  `modal-transitions.spec.ts:38 ... locator.click: Test timeout of 30000ms exceeded` while
  "waiting for element to be visible, enabled and stable". Only `retries: 1` hid it. Two starved
  attempts in a row fail the build job and stop the deploy.
- **fix:** `workers: process.env.CI ? 1 : undefined` in `playwright.config.ts`.
- **note:** `trace: "on-first-retry"` records a trace, but the report upload is `if: failure()`,
  so a flaky *pass* discards the only trace of the flake.

---

## MEDIUM

### M1 — Net flags stay lit after a geometry rebuild
- **file:** `src/app/src/app/components/CircuitTrace.tsx:678, 846-856, 1196`
- **failure:** The animation loop writes `flag.style.color` straight to the DOM, and the net-flag
  `<g>` elements are keyed by index, so React reuses them across a rebuild and does not repaint.
  The new effect seeds every `prevFlag[i]` to `false`, so a flag that should now be unlit compares
  equal and is never written. Repro: scroll past the rectifier until `net-1` ("+12V") turns
  orange, then open Updates — `useHashRoute.ts:82` scrolls to the top and CircuitTrace rebuilds
  with `pageKey="updates"`. `net-1` is now "GND" and stays orange with the bolt at the top of the
  page. The same stale state can hit components, vias and junctions (`prevLitRef` at 910,
  `prevVia`/`prevJunction` at 676-677).
- **fix:** Seed the previous-state arrays with holes (`new Array(n)`, never equal to a boolean)
  instead of `.fill(false)` at 676-678 and 910, so the first frame after a rebuild writes every
  element.

### M2 — Orbit clock jumps by the full hidden duration after a background tab returns
- **file:** `public/portfolio/assets/viewers/board-viewer-shell.html:541`
- **failure:** rAF stops while the tab is hidden but `playing` stays true, since IntersectionObserver
  does not fire on a tab switch. On the control board's 25.5s cycle, a 10s tab switch adds 10s to
  `orbitElapsed` on the first frame back and snaps the camera into a travel or hold leg. Hidden
  longer than the rest of the cycle, that first frame crosses the wrap, posts `tour-cycle`, and the
  showcase switches boards with no visible tour.
- **fix:** `orbitElapsed += Math.min(now - orbitLast, 100);`

### M3 — Tour JSON fetch has no timeout, so a stalled request wedges the showcase
- **file:** `public/portfolio/assets/viewers/board-viewer-shell.html:903` (guard at `:430`)
- **failure:** `tour-cycle` is posted only once `tourFetchSettled` is true. A request that never
  settles — flaky mobile connection, a proxy holding the socket — leaves the flag false forever,
  the lead board orbits its bare 6s loop indefinitely, and `BoardShowcase` never advances. The
  geometry fetch 200 lines earlier already guards this with `AbortSignal.timeout(15000)`.
- **fix:** Pass the same `fetchOptions` to the tour fetch; a timeout rejects into the existing
  `.catch`, which sets the flag and falls back to the plain orbit.

### M4 — The `.pcbgeo` drift test checks only the header
- **file:** `tests/board-geometry-invariants.test.ts:122`
- **failure:** The test compares per-mesh `vertexCount`, `indexCount`, `min` and `scale`. Regenerate
  the bundle with `build:vrml` so interior vertices or winding change while each bounding box and
  count stays the same — moving a part inside the board outline does exactly this — and skip
  `build:geometry`, and the shipped binary still passes every assertion while serving stale
  geometry. Nothing checks `positionOffset`, `indexOffset` or `indexType`.
- **fix:** Export `encodeBoard` from `tools/build-board-geometry-bin.mjs`, run `main()` only when
  executed directly, and assert `gunzipSync(shipped).equals(encodeBoard(bundle).buffer)`. Encoding
  is deterministic, so this is byte-exact.

### M5 — Copy-email result is never announced to screen readers
- **file:** `src/app/src/app/components/Contact.tsx:108`
- **failure:** `aria-label` on the button overrides its inner text, so the status swap
  ("ACK, copied to clipboard" / "Couldn't copy...") at lines 114-151 is never read, and there is no
  `aria-live` region anywhere in the component. On failure — clipboard denied in an insecure
  context, `execCommand` returning false — the user is never told, so they paste nothing.
- **fix:** Add `<span role="status" aria-live="polite" className="sr-only">` carrying the result.

### M6 — `Skills` uses `role="tab"` with no tabs keyboard model
- **file:** `src/app/src/app/components/Skills.tsx:49-80`
- **failure:** A screen reader announces "Electrical, tab, selected, 1 of 2", telling the user to
  press arrow keys. There is no `onKeyDown` and no roving `tabIndex`, so ArrowRight does nothing
  and both tabs are separate Tab stops — the announced widget does not exist.
- **fix:** Drop the tab semantics (smaller change): remove `role="tablist"`, `role="tab"`,
  `aria-selected`, `aria-controls`, `role="tabpanel"` and the `id`/`aria-labelledby` pair, and use
  `aria-pressed` on the two buttons.

### M7 — Segmented toggles expose no selected state
- **file:** `src/app/src/app/components/Projects.tsx:41-62`,
  `src/app/src/app/components/ThemeToggle.tsx:43-68`
- **failure:** Active state is conveyed by colour alone. A screen-reader user hears "All Projects,
  button" and "Featured, button" with no way to tell which filter is on, and nothing announces the
  grid shrinking. Same for "Light, button" / "Dark, button". Fails WCAG 4.1.2.
- **fix:** Add `aria-pressed` to both pairs.

### M8 — Update-feed sort keys silently misdate full month names
- **file:** `src/app/src/app/data/portfolio.ts:853, 861`
- **failure:** `MONTH_MAP` holds only 3-letter keys, but the same file writes full names elsewhere
  ("September 2026 — December 2026"). A new build with `week: "September 12th - 18th, 2026"` gets
  sort key `20260112` and sorts as January, below older entries. The guard at
  `tests/period-parsing.test.ts:40-47` only checks `parsePeriodStart(entry.period) !== 0`, never the
  `week`-derived `sortKey` that is actually used — and a wrong month is never `0`, so CI passes.
- **fix:** Look up `MONTH_MAP[m[1].slice(0, 3)]` in both places; `"September".slice(0,3)` is `"Sep"`.

### M9 — Reduced-motion users still get smooth scrolling on mobile
- **file:** `src/app/src/styles/globals.css:256-258` (with `hooks/useHashRoute.ts:28`)
- **failure:** Below `lg`, `<main>` is not the scroll container, so the document scrolls. Per CSSOM
  View, the hook's `behavior: "auto"` defers to the scrolling box's computed `scroll-behavior`,
  which is `smooth` on `html`. Sidebar nav, deep links, the skip link and the `window.scrollTo` in
  the updates branch all animate for users who asked for no motion; the hook's reduced-motion check
  does nothing on mobile.
- **fix:** Wrap the rule in `@media (prefers-reduced-motion: no-preference)`. One CSS change covers
  the hook, the skip link and `scrollTo`.

### M10 — `useHashRoute` has no test coverage for its non-trivial logic *(R4 + R5, merged)*
- **file:** `src/app/src/app/hooks/useHashRoute.ts:39-54, 117-148`
- **failure:** No test imports the hook. Three behaviours are wholly untested: the double-rAF
  "last navigation wins" race guard; the skip-link guard (`#main-content` must not close an open
  project modal); and hash write-back, which must not ping-pong with the `hashchange` listener.
  `isAppRoute` is unit-tested in isolation, but nothing checks that the hook calls it — deleting
  the guard reintroduces the skip-link bug with CI green. e2e only covers a cold deep link.
- **fix:** One jsdom test in the style of `tests/use-modal-stack.test.ts`, plus one e2e case that
  activates the skip link with a project modal open.

### M11 — `theme-bootstrap`'s throw-handling paths are untested
- **file:** `src/app/src/app/lib/theme-bootstrap.ts:13-26`
- **failure:** The try/catch blocks exist because a throwing `localStorage` (Safari private mode,
  blocked storage, sandboxed webview) would blank the page before React mounts. All 5 tests use a
  working `localStorage` and `matchMedia`, so removing the catch keeps CI green while the site goes
  blank for those users.
- **fix:** Two tests — `getItem` throwing with a dark preference expects `"dark"`; `matchMedia`
  throwing expects `"light"`.

### M12 — `copyText`'s fallback branches are untested
- **file:** `tests/contact-copy-text.test.ts:17-36`, `src/app/src/app/components/Contact.tsx:38-62`
- **failure:** Only "`writeText` resolves" and "`clipboard` undefined" are covered. The real-world
  case — `writeText` rejecting with `NotAllowedError` — is not, nor is `execCommand` returning
  false. Collapsing the first try/catch into a bare `.then(() => true)` keeps both tests green
  while the `execCommand` fallback disappears. The test also assigns `document.execCommand`
  directly, so `vi.restoreAllMocks()` never undoes it.
- **fix:** Add both cases; use `vi.spyOn(document, "execCommand")`.

### M13 — `asset-references` prefix fallback accepts truncated or typo'd paths
- **file:** `tests/asset-references.test.ts:54-62`
- **failure:** The `startsWith` fallback runs for *every* reference, not only for template literals
  cut off at `${`. A typo like `.../aux-power-board-banner.web` (missing `p`) passes because the
  real file starts with it, as does `.../cameron-lewis-resume.pd` or a stub like `.../aux`. Each
  ships as a 404 — the exact bug class this test claims to catch.
- **fix:** Capture whether a match was cut off by an interpolation (`(?=\$\{)`) and apply the
  fallback only to those; every other path must pass `existsSync` exactly.

### M14 — "tall viewport defers the mount past load" asserts an order the code does not enforce
- **file:** `e2e/board-spin.spec.ts:~725-732`, `src/app/src/app/components/BoardShowcase.tsx:68-69`
- **failure:** The mount is gated only on `requestIdleCallback`; nothing ties it to `load`. If the
  browser goes idle while waiting on the fonts stylesheet, or in the few ms between `load` and the
  CDP round trips before `count()`, the iframe is already mounted and `toBe(0)` fails. It passes
  today only because a starved runner never reaches idle. This test is on the deploy-gating path.
- **fix:** `page.addInitScript` replacing `requestIdleCallback` with one that stores the callback;
  assert `count()` is 0, then invoke the callback and assert the mount. Tests the gate, not a race.

### M15 — No e2e coverage for the project → organization → back handoff
- **file:** `e2e/modal-transitions.spec.ts` (missing case); `ProjectModal.tsx:139-146`,
  `OrganizationContextModal.tsx:112-120`
- **failure:** `onOpenOrganization` is the only caller of the `restoreProject === true` branch in
  `useModalStack`, and `organizationToProject` is also untested. A regression — `openOrganization`
  no longer setting `returnProject`, or the org dialog staying mounted — passes CI and ships,
  dropping the user on a bare page from a deep-linked project. That is the same bug class the
  report-viewer test was added for.
- **fix:** One test: deep-link a project, open the org context, close it, expect
  `button "Explore 3D Board"` still visible.

---

## LOW

| ID | File | Issue | Fix |
| --- | --- | --- | --- |
| L1 | `circuit-geometry.ts:95-106` | `placeCenterpieces` is test-only and models placement with one fixed `avail`, while `buildTrace:1502` recomputes it per gap — the real walk can break with its 3 tests green | Delete it and its tests; the `buildTrace` tests already cover the behaviour through real code |
| L2 | `CircuitTrace.tsx:21` | `MAX_BRANCHES = 8` is read by nothing, implying a cap that does not exist | Delete the line |
| L3 | `circuit-geometry.ts:369-372` | `filterUsableGaps` alias exists only to dodge shadowing; its comment points at an import that no longer exists | Rename the local variable, delete the alias |
| L4 | `InteractiveBomViewer.tsx:27`, `portfolio.ts:467` | Brick's `bomUrl` override bypasses `loadInteractiveBom`, so a 404 renders the host 404 page in the iframe with no Retry card — and `bomUrlByAsset.brick` already resolves to the same file | Delete the override, its branch, the `bomUrl` field, and the asset-list entry |
| L5 | `InteractiveBomViewer.tsx:91` | `sandbox="allow-scripts allow-same-origin"` blocks IBOM's own `target="_blank"` links, so the help link and every datasheet field silently does nothing | Add `allow-popups allow-popups-to-escape-sandbox` |
| L6 | `BoardShowcase.tsx:217` | `opacity-0` hides captions visually only; AT reads every board title at once | `aria-hidden={!(index === active && showBoard)}` |
| L7 | `build-board-geometry-bin.mjs:33`, `build-board-vrml.mjs:22` | `URL.pathname` stays percent-encoded, so a clone under a path with spaces fails with ENOENT | Use `fileURLToPath`, as `build-board-tour.mjs:19` already does |
| L8 | `ThemeProvider.tsx:37-55` | No same-theme guard, so clicking the active theme replays the ~850ms `rail-up` animation on every section for no change | Early-return when the theme is unchanged |
| L9 | `Contact.tsx:81-82, 170-193` | Hardcoded social fallbacks are unreachable (Home asserts the entries with `!`) and email has two sources of truth, so the button can display one address and copy another | Use `socialLinks` directly as Home does; copy `emailLink.value` |
| L10 | `Skeletons.tsx:149-162` | Mount effect resets `loaded` to `false` right after the ref set it to `true`; converges only because the inline ref callback is fresh each render — memoize it and a cached image stays invisible forever | Key the `<img>` by `src`, or track `loadedSrc` |
| L11 | `ui/dialog.tsx` | `DialogTrigger`, `DialogClose`, `DialogHeader`, `DialogFooter` — ~40 lines, zero importers | Delete them, trim the export list |
| L12 | `Logo.tsx:42`, `components/figma/` | Dead default export plus an empty untracked directory | Delete both |
| L13 | `OrganizationContextModal.tsx:41, 51-53` | sr-only `DialogTitle` plus a visible `h3` makes AT read the org name twice at two heading levels | `<DialogTitle asChild><h2>` on the visible heading |
| L14 | `default_theme.css:6-45` | Fully dead: `globals.css:207-248` redeclares the same `@theme inline` block as an exact superset, so edits to the file `CLAUDE.md` names are silently overridden | Delete the file and its import; correct the `CLAUDE.md` styling bullet |
| L15 | `globals.css` (~60 declarations) | Unused shadcn tokens: `--popover`, `--secondary`, `--input*`, `--switch-background`, `--chart-1..5`, all `--sidebar-*` (the Sidebar uses its own `--sidebar-item-*`) | Delete them and their `@theme` mappings; keep `--card`, `--muted`, `--accent`, `--destructive`, `--ring`, `--border`, `--radius-*` |
| L16 | `useHashRoute.ts:150` | Returns `setView`/`setActiveSection`, which no caller uses and which invite bypassing `navigate`'s pending-scroll logic | Drop them from the return object |
| L17 | `vitest.config.ts:5-9` | Dead `@` alias pointing at `./src`, the wrong tree — Vite has no match, so a new test using it would resolve differently from the build | Delete the block |
| L18 | `package.json:43`, `patch-rollup-native.mjs` | `lightningcss-darwin-arm64` is already an optional dep of `lightningcss` and is symlinked, so the "codex workspace fallback" patch loop never runs — it is a platform-mismatched direct devDependency on Linux CI | Remove both; verify with a clean install and build first |

---

## Owner decisions required

These two are factual contradictions in `portfolio.ts`. Both need Cameron to say which record is
right; neither can be resolved from the code.

1. **Thermal Camera sensor** — `portfolio.ts:375` tags `"MLX90640 Thermal Sensor"` while `:378`
   and the Updates entry at `:748/:754` say `AMG8833`. Different parts (32×24 vs 8×8).
2. **Paradigm role and start date** — Experience (`:234-236`) says `"Electrical Team Lead"`,
   `"September 2025 — Present"`; the organization record (`:527-528`) says `"Electrical Team"`,
   `"Jan 2026 — Present"`. Both are visible on the same page, since the experience card opens the
   org modal.
