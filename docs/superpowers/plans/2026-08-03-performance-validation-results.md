# Performance Validation Results — 2026-08-03

Measured via Lighthouse against a local `vite preview` of the production build (post Task 9's dependency cleanup).

Command run: `npx -y lighthouse http://localhost:4173 --output=json --output-path=/tmp/lighthouse-report.json --chrome-flags="--headless" --only-categories=performance`. Lighthouse launched its own headless Chrome successfully in this sandbox (no fallback to the Playwright-installed Chromium was needed).

| Metric | Value |
|---|---|
| LCP | 3.4 s |
| CLS | 0.001 |
| TBT | 70 ms |
| Performance score | 0.84 |

## Decision: manualChunks split

The audit criteria: implement `manualChunks` only if TBT is elevated (>200ms) OR performance score is below 90, **and** the main chunk is flagged by Lighthouse's "Reduce JavaScript execution time" or "Minimize main-thread work" audits as a contributor.

- Performance score (0.84) is below 90, but TBT is low (70 ms, well under the 200 ms threshold).
- The `mainthread-work-breakdown` audit scored 1 (pass, 1.4s total) and `bootup-time` scored 1 (pass, 0.3s) — neither flags the 545 kB main chunk as a contributor to a real bottleneck.
- `unused-javascript` shows only ~52 KiB of estimated savings — not the main chunk's fault, and not large enough to justify a build config change.
- The sub-90 score here is most plausibly driven by LCP (3.4s), which is a local/unthrottled-network artifact of this sandbox, not a JS-execution-time or main-thread-blocking problem that `manualChunks` would address.

**Decision: no action.** Do not add `manualChunks` to `vite.config.ts`. The measured data does not show the main chunk as an actual bottleneck — TBT and main-thread-work audits both pass. Splitting vendor code speculatively here would add build complexity without addressing a demonstrated problem. `vite.config.ts` was not modified.

**Caveat:** this is a local, unthrottled measurement — it does not replace a real-network/real-device Lighthouse run against the deployed `cameron-lewis.com`, which needs the live URL and is out of scope for a local sandbox.
