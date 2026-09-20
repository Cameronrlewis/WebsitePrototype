---
name: verify
description: Run the full verification gate for this repo, in the right order, with the right pins.
---

# Verify

Run every gate this repo has, in this order, and report the real exit code of each. Do not claim
anything passes without having run it in this message.

```bash
npx pnpm@10.17.1 typecheck                       # tsc --noEmit
npx pnpm@10.17.1 test                            # vitest run
npx pnpm@10.17.1 build                           # vite build
npx pnpm@10.17.1 e2e                             # Playwright vs dev server (:5173)
E2E_TARGET=preview npx pnpm@10.17.1 e2e          # Playwright vs production bundle (:4173)
```

`pnpm build` does **not** run `tsc`. A change can build fine and still be type-broken, so
`typecheck` is the gate that catches it, never `build`.

## Always pin pnpm to 10.17.1

Never `pnpm@latest`, never an unpinned `pnpm` from PATH. A newer pnpm major has silently dropped
the `pnpm.overrides` block in `package.json` that pins `vite` to `6.3.5` and aliases `rollup` to
`npm:@rollup/wasm-node`. Losing it breaks the build in a way that looks like a native-binary error
and takes a long time to trace back.

On macOS npm-cache permission errors:
`env npm_config_cache=/private/tmp/npm-cache npx pnpm@10.17.1 install`

## Where the code actually is

The real application lives under `src/app/src/app/`, **not** `src/`. Live stylesheets are only in
`src/app/src/styles/`. There is no path alias - imports are relative.

## Failures that are silent - check these when touching layout

`CircuitTrace.tsx` measures the rendered layout at runtime rather than dictating it. Two
constraints drop content with no error:

Both thresholds are defined once, in `src/app/src/app/lib/circuit-geometry.ts` — read the
values there, never from this file:

- Inter-section gaps must stay `>= MIN_GAP_DEPTH`. `Layout.tsx` uses
  `space-y-16 lg:space-y-24`. Reducing the desktop gap below that drops **every** IC block and
  leaves only the bare spine. `tests/layout-trace-constraints.test.ts` asserts this against the
  constant.
- The buck block needs `CENTERPIECE_SPECS.buck.minAvail` of horizontal room. Below that,
  `planCenterpiece` returns null and every downstream rail stage disappears with it.

Both warn in dev only, via `import.meta.env.DEV` in `CircuitTrace.tsx`. Neither fails a build. If
you changed section spacing or `<main>`'s width, load the page and confirm the rail labels read
`AC IN -> +12V -> +3V3 -> +1V8 -> GND`; missing `+12V` onward means a block failed to place.

## The deploy gate

`pages.yml`'s build job runs the production-bundle e2e between `Build` and `Upload artifact`, and
`deploy` declares `needs: build`. A failing bundle e2e therefore **blocks the deploy**. If it goes
red, make the test deterministic - never move the step after the artifact upload, because that
step order is the entire gate.

## Reporting

State each command's exit code and the actual counts (tests passed, tests failed). If e2e times
out locally, check machine load before concluding there is a regression: these tests run in a few
seconds idle, and blow their 30s timeout under heavy load.
