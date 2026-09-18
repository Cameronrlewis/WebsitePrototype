# Simplification Plan

**Goal:** Delete 567 lines and 2 dependencies that nothing uses.

**Approach:** This is deletion, not construction. No TDD cycle: the existing gate is the test. Each step deletes, then runs the gate. If the gate stays green the code was dead; if it goes red, stop and put it back.

**Gate (the only verification any step needs):**
```bash
npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build && npx pnpm@10.17.1 e2e
```
Baseline before starting: typecheck clean, 86 unit, build ok, 20 e2e.

**Order:** free deletions first, judgement calls last, so you can stop anywhere and still be ahead.

---

## 1. The tested shadow timeline (122 lines)

`src/app/src/app/lib/tour-timeline.ts` has no runtime consumer. Only `tests/tour-timeline.test.ts` imports it; `e2e/board-spin.spec.ts` merely names it in a comment. The copy that actually runs is in `board-viewer-shell.html`, and `e2e/board-spin.spec.ts` already pins that copy against exact constants and phase results.

This is the same defect a review killed in `lib/board-spin.ts` on the previous branch. The e2e guard added in the fix round is what makes deleting it safe.

```bash
git rm src/app/src/app/lib/tour-timeline.ts tests/tour-timeline.test.ts
```

Then in `board-viewer-shell.html`, update the comment above the mirrored `tourPhase` (it points at the deleted file) to say the shell owns the only copy and that `e2e/board-spin.spec.ts` pins it. Same edit in `e2e/board-spin.spec.ts` around line 258.

Gate. Expect 76 unit tests (down 10), e2e unchanged at 20.

## 2. Orphan geometry tools and the `three` dependency (348 lines, 1 dep)

`build-brick-geometry.mjs`, `debug-vrml.mjs` and `flatten-vrml.mjs` are one-offs whose output is already checked in as `brick.pcbgeo`. No `package.json` script references any of them. They are the only importers of `three`; the runtime uses the vendored `public/portfolio/assets/viewers/vendor/three.min.js`, not the npm package.

**Check before cutting:** this is the one deletion with a real future cost. If you ever need to regenerate brick geometry from VRML source, these are how. Git history keeps them, so recovery is `git show`, but decide deliberately.

```bash
git rm tools/build-brick-geometry.mjs tools/debug-vrml.mjs tools/flatten-vrml.mjs
npx pnpm@10.17.1 remove -D three
```

Delete their three lines from the tools table in `README.md` (lines 88, 92, 93).

Gate. `pnpm install` side effects: none expected, but confirm `pnpm-lock.yaml` changes only drop `three`.

## 3. Unused exports (35 lines)

Verified to have no importer outside their own file.

- `src/app/src/app/components/Skeletons.tsx`: `SkeletonLines`, `ImageWellSkeleton`, `DocumentPageSkeleton`
- `src/app/src/app/data/portfolio.ts`: `organizationsById`, `featuredProject`, `latestUpdate`

Delete each function or const outright, not just the `export` keyword. Gate.

## 4. Dead tour JSON fields (~15 lines)

The shell reads `id`, `label`, `blurb`, `span`, `x`, `y`. It never reads `refs` or `flipY`.

Counter-argument worth weighing: `refs` is provenance, the only record in the generated file of which components a stop covers, and `flipY` records the transform that produced the coordinates. Both are cheap. Cut them only if you want the file to be exactly what is consumed.

If cutting: drop them from the object literal in `tools/build-board-tour.mjs`, then `npx pnpm@10.17.1 build:tour control` to regenerate. Gate.

## 5. The hand-written declaration file (27 lines, 1 file)

`tools/board-tour-geometry.d.mts` exists only so `tests/board-tour-geometry.test.ts` typechecks, and nothing enforces it against the `.mjs` it describes.

Replace with `// @ts-check` plus JSDoc `@param`/`@returns` on the two functions in `tools/board-tour-geometry.mjs`, then `git rm tools/board-tour-geometry.d.mts`. That puts the types on the implementation, where drift is impossible.

Gate. If `tsc` cannot resolve the JSDoc types through the `.mjs` under `allowJs: false`, revert this one and keep the declaration: it is 27 lines and the arrangement is already verified working.

## 6. The Button variant engine (~20 lines, 1 dep)

`class-variance-authority` drives 2 variants and 2 sizes in `src/app/src/app/components/ui/button.tsx`. A plain lookup object plus the existing `cn()` covers it and drops the dependency. `Slot` stays: `asChild` has 5 real callers.

Weakest item on the list. `cva` is idiomatic shadcn and you may want to stay close to upstream for future component pulls. Skip unless you have no intention of pulling more shadcn components.

---

## Notes

- **Execute on `feat/board-guided-tour`, not a fresh branch off `main`.** Items 1, 4 and 5 delete files that only exist on that branch, so a branch off main cannot do them. Decided with the user; it ships as one PR.
- One commit per numbered section, so any single cut is revertible alone.
- Out of scope: correctness, security, performance. This is dead weight only.
