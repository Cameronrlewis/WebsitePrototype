# Deploy-Gate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the new production-bundle deploy gate works in both directions, and remove the cost it adds to every deploy, before PR #7 merges to main.

**Architecture:** PR #7 moved the `E2E_TARGET=preview` Playwright run into `pages.yml`'s `build` job, between Build and Upload artifact, so that the existing `deploy: needs: build` blocks a deploy when the production bundle is broken. That gating path cannot run on a pull request, because `pages.yml` triggers only on push to main and `workflow_dispatch`. This plan uses `workflow_dispatch` against the PR branch to exercise the real path twice — once proving it blocks a bad bundle, once proving it passes a good one — then caches the Playwright browser download that the gate added to the deploy path.

**Tech Stack:** GitHub Actions, Playwright 1.49.1 (pinned exactly in `package.json`), pnpm 10.17.1 (pinned in every workflow via `pnpm/action-setup@v6`), Vite 6.3.5, GitHub Pages.

**Spec:** PR https://github.com/Cameronrlewis/WebsitePrototype/pull/7 and the zero-edge audit artifact (finding A1). There is no separate spec document; the PR body is the authority for intent.

## Global Constraints

- Never use `pnpm@latest` anywhere. Every pnpm invocation is `npx pnpm@10.17.1` locally and `pnpm/action-setup@v6` with `version: 10.17.1` in CI. A newer pnpm major silently drops the `pnpm.overrides` block that pins `vite` to `6.3.5` and aliases `rollup` to `@rollup/wasm-node`, which breaks the build.
- `pnpm build` does NOT run `tsc`. The full local gate is `npx pnpm@10.17.1 typecheck && npx pnpm@10.17.1 test && npx pnpm@10.17.1 build`.
- Do not modify `concurrency: group: pages` / `cancel-in-progress: false` in `pages.yml`. Serializing deploys is correct and intentional.
- Do not change `playwright.config.ts`'s `retries: process.env.CI ? 1 : 0`. Flakiness policy is a deliberate non-goal of this plan (see "Deliberately Not Doing").
- The real application lives at `src/app/src/app/`, not `src/`.
- Task 1 and Task 2 both run a workflow that CAN deploy to the live site at cameron-lewis.com. Read each task's safety note before dispatching. Never dispatch `pages.yml` against a branch whose diff from `main` touches anything outside `.github/`.

---

## File Structure

| File | Responsibility | Touched by |
|---|---|---|
| `.github/workflows/pages.yml` | Deploy pipeline. Owns the gate. Gains browser caching in Task 3. | Task 3 |
| `.github/workflows/e2e.yml` | Non-gating e2e. Already correct after PR #7; read-only here. | none |
| `e2e/circuit-trace.spec.ts` | Temporarily broken in Task 2 to prove fail-closed, then reverted. | Task 2 (reverted) |
| `docs/superpowers/plans/2026-09-16-gate-deploy-hardening.md` | This plan. | — |

No application code changes. Every change in this plan is CI configuration or a temporary, reverted test mutation.

---

### Task 1: Prove the gate fails closed

The highest-value check, and the only one with zero deploy risk: if the bundle e2e fails, the `build` job must fail before `Upload artifact`, so `deploy` is skipped and the live site is never touched.

**Safety note:** this task deliberately makes CI red on a scratch branch. Because the e2e step sits BEFORE `Upload artifact` and `deploy` declares `needs: build`, a failure here means **no artifact is uploaded and no deploy runs**. The live site cannot change during this task. That is exactly the property being proven.

**Files:**
- Modify (temporarily, reverted in Step 7): `e2e/circuit-trace.spec.ts`
- Read only: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: the `pages.yml` `build` job as written on branch `ci/gate-deploy-on-preview-e2e`.
- Produces: a confirmed run URL showing `build` failed and `deploy` was skipped. Task 2 relies on nothing from this task except the confidence it establishes.

- [ ] **Step 1: Confirm you are on the PR branch and it is CI-only**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
git checkout ci/gate-deploy-on-preview-e2e
git diff main...HEAD --name-only | grep -v '^\.github/' | grep . \
  && echo "STOP: non-CI changes present, do not dispatch pages.yml" \
  || echo "OK: CI-only diff"
```

Expected: `OK: CI-only diff`. If it prints STOP, halt and report — dispatching would deploy non-main application code.

- [ ] **Step 2: Create a scratch branch for the deliberate break**

```bash
git checkout -b ci/prove-gate-fails-closed
```

- [ ] **Step 3: Break one assertion so the production-bundle run fails**

Edit `e2e/circuit-trace.spec.ts`. Find the net-flag assertion loop that checks for `AC IN`, `+12V`, `+3V3`, `+1V8`, `GND`. Add this single failing assertion immediately after that loop, inside the same `test(...)` body:

```ts
  // TEMPORARY - proving the deploy gate fails closed. Reverted in this same task.
  await expect(trace.getByText("THIS TEXT DOES NOT EXIST", { exact: true })).toBeVisible({ timeout: 2000 });
```

Do not touch any other file. Do not change `playwright.config.ts`.

- [ ] **Step 4: Confirm it fails locally against the production bundle first**

Running it locally first avoids burning a CI round trip on a typo.

```bash
npx pnpm@10.17.1 build
E2E_TARGET=preview npx pnpm@10.17.1 e2e 2>&1 | tail -20
```

Expected: FAIL, with `circuit-trace.spec.ts` reporting the missing `THIS TEXT DOES NOT EXIST` locator. If it PASSES, the assertion was added to the wrong place — fix it before continuing.

- [ ] **Step 5: Push the scratch branch and dispatch the deploy workflow against it**

```bash
git add e2e/circuit-trace.spec.ts
git commit -m "test: temporarily break bundle e2e to prove the deploy gate fails closed"
git push -u origin ci/prove-gate-fails-closed
gh workflow run pages.yml --ref ci/prove-gate-fails-closed
```

Note: `gh workflow run` targets `pages.yml` by filename. It works against a non-default branch because `pages.yml` already exists on `main` and declares `workflow_dispatch`.

- [ ] **Step 6: Confirm build failed AND deploy was skipped**

```bash
sleep 30
RUN=$(gh run list --workflow pages.yml --branch ci/prove-gate-fails-closed --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" --exit-status; echo "watch_exit=$?"
gh run view "$RUN" --json jobs -q '.jobs[] | "\(.name)\t\(.conclusion)"'
```

Expected: `watch_exit` is non-zero, and the job list shows `build` with conclusion `failure` and `deploy` with conclusion `skipped` (or absent). **`deploy` must NOT be `success`.** If `deploy` succeeded, the gate does not work — stop, do not merge PR #7, and report that the `needs: build` relationship is not blocking.

- [ ] **Step 7: Revert the break and delete the scratch branch**

```bash
git checkout ci/gate-deploy-on-preview-e2e
git branch -D ci/prove-gate-fails-closed
git push origin --delete ci/prove-gate-fails-closed
```

Verify the temporary assertion is gone from the working tree:

```bash
grep -n "THIS TEXT DOES NOT EXIST" e2e/circuit-trace.spec.ts && echo "STOP: break still present" || echo "OK: clean"
```

Expected: `OK: clean`. There is no commit in this task — the scratch branch is discarded entirely.

---

### Task 2: Prove the gate passes a good bundle and deploys

Task 1 proved the gate blocks. This proves it does not block a healthy build — a gate that always fails is just as broken.

**Safety note:** this task DOES deploy to cameron-lewis.com. It is safe only because `ci/gate-deploy-on-preview-e2e` differs from `main` exclusively in `.github/`, so the built site is byte-identical to what is already live. Step 1 re-verifies this. **Get explicit confirmation from Cameron before Step 3** — this publishes to the live domain.

**Files:**
- Read only: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: branch `ci/gate-deploy-on-preview-e2e` as pushed.
- Produces: a green `pages.yml` run whose `build` job includes a passing `E2E against the production bundle` step. Task 3 modifies this same job afterwards.

- [ ] **Step 1: Re-verify the branch is still CI-only**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
git checkout ci/gate-deploy-on-preview-e2e
git diff main...HEAD --name-only
```

Expected: exactly two lines, `.github/workflows/e2e.yml` and `.github/workflows/pages.yml`. Anything else means the deploy would publish non-main content — halt and report.

- [ ] **Step 2: Confirm the site's current live state, to compare against afterwards**

```bash
curl -s https://cameron-lewis.com/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1
```

Record this bundle filename. Since the branch changes no application code, the same hash should be serving after the deploy.

- [ ] **Step 3: Ask Cameron to confirm, then dispatch**

Do not run this without an explicit go-ahead in the conversation.

```bash
gh workflow run pages.yml --ref ci/gate-deploy-on-preview-e2e
```

- [ ] **Step 4: Watch the run to completion**

```bash
sleep 30
RUN=$(gh run list --workflow pages.yml --branch ci/gate-deploy-on-preview-e2e --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" --exit-status; echo "watch_exit=$?"
gh run view "$RUN" --json jobs -q '.jobs[] | "\(.name)\t\(.conclusion)"'
```

Expected: `watch_exit=0`, `build` = `success`, `deploy` = `success`.

- [ ] **Step 5: Confirm the gate step actually ran (not silently skipped)**

A green run proves nothing if the e2e step never executed.

```bash
gh run view "$RUN" --log | grep -E "E2E against the production bundle|[0-9]+ passed" | head -10
```

Expected: the step name appears, followed by a Playwright summary line reading `7 passed`. If the step is absent, the YAML placed it outside the `build` job — stop and fix before merging.

- [ ] **Step 6: Confirm the live site is unchanged**

```bash
sleep 30
curl -s -o /dev/null -w "site=%{http_code}\n" https://cameron-lewis.com/
curl -s https://cameron-lewis.com/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1
```

Expected: `site=200` and the same bundle filename recorded in Step 2. A different hash means application code differed between the branch and main — investigate before merging.

---

### Task 3: Cache the Playwright browser download

The gate added a Chromium install to every deploy. Caching it removes roughly 30-40s from the deploy path without weakening the gate.

**Files:**
- Modify: `.github/workflows/pages.yml` (the `Install Chromium` step added by PR #7)
- Test: CI run timing, compared against the Task 2 baseline

**Interfaces:**
- Consumes: the `build` job validated in Task 2.
- Produces: the final `pages.yml` merged by Task 4. No other task depends on its internals.

- [ ] **Step 1: Record the Task 2 baseline timing for comparison**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
RUN=$(gh run list --workflow pages.yml --branch ci/gate-deploy-on-preview-e2e --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$RUN" --json jobs -q '.jobs[] | "\(.name)\t\(.startedAt)\t\(.completedAt)"'
```

Write the `build` job duration down. Step 6 compares against it.

- [ ] **Step 2: Replace the single install step with a cached pair**

In `.github/workflows/pages.yml`, replace exactly this:

```yaml
      - name: Install Chromium
        run: pnpm exec playwright install --with-deps chromium
```

with this:

```yaml
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}

      # On a cache hit the browser binaries are already on disk, but the OS
      # packages they link against are not cached, so they still need installing.
      - name: Install Chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Install Chromium system deps
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium
```

The cache key is derived from `pnpm-lock.yaml` rather than a hardcoded `1.49.1`, so bumping Playwright invalidates the cache automatically. Hardcoding a version here would reproduce the exact defect the audit found in `tools/patch-rollup-native.mjs`.

- [ ] **Step 3: Verify `actions/cache@v4` is the current major before committing**

Other actions in this repo are pinned to v5/v6/v7; `actions/cache` is on a different major line, so confirm rather than pattern-match.

```bash
gh api repos/actions/cache/releases/latest -q .tag_name
```

Expected: a `v4.x.x` tag. If it reports v5 or higher, use that major in Step 2 instead and note the change.

- [ ] **Step 4: Verify the YAML parses and the step order is still correct**

```bash
python3 -c "
import yaml
d = yaml.safe_load(open('.github/workflows/pages.yml'))
steps = [s['name'] for s in d['jobs']['build']['steps'] if 'name' in s]
print(steps)
assert d['jobs']['deploy']['needs'] == 'build', 'deploy must still need build'
e2e_i = steps.index('E2E against the production bundle')
up_i = steps.index('Upload artifact')
assert e2e_i < up_i, 'the gate must run BEFORE the artifact upload'
print('OK: gate at', e2e_i, 'upload at', up_i)
"
```

Expected: `OK: gate at <n> upload at <m>` with the gate index lower. This assertion is the whole point of the gate — if it ever inverts, a broken bundle uploads before anyone notices.

- [ ] **Step 5: Commit and push**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: cache Playwright browsers in the deploy job

The deploy gate added a Chromium download to every deploy. Cache it on
pnpm-lock.yaml's hash so a Playwright bump invalidates the cache on its own,
rather than pinning a version that silently goes stale."
git push
```

- [ ] **Step 6: Dispatch twice and confirm the second run is faster**

The first run populates the cache and will NOT be faster; only the second shows the benefit.

```bash
gh workflow run pages.yml --ref ci/gate-deploy-on-preview-e2e
sleep 30
RUN1=$(gh run list --workflow pages.yml --branch ci/gate-deploy-on-preview-e2e --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN1" --exit-status; echo "run1_exit=$?"

gh workflow run pages.yml --ref ci/gate-deploy-on-preview-e2e
sleep 30
RUN2=$(gh run list --workflow pages.yml --branch ci/gate-deploy-on-preview-e2e --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN2" --exit-status; echo "run2_exit=$?"
gh run view "$RUN2" --log | grep -iE "Cache restored|cache-hit|Post Cache" | head -5
```

Expected: both exit 0; run 2 logs a cache restore, and its `build` job is measurably shorter than the Task 3 Step 1 baseline. If run 2 shows no cache hit, the `path` or `key` is wrong — fix before merging rather than shipping a cache that never hits.

Note both dispatches deploy, under the same Task 2 safety reasoning: the branch is still CI-only.

---

### Task 4: Merge

**Files:**
- Read only: everything. This task only merges and verifies.

**Interfaces:**
- Consumes: a green `ci/gate-deploy-on-preview-e2e` validated by Tasks 1-3.
- Produces: the gate live on `main`.

- [ ] **Step 1: Confirm PR checks are green and the branch is still CI-only**

```bash
cd /Users/cameron/Documents/WebsitePrototype-main
gh pr checks 7
gh pr view 7 --json mergeable,mergeStateStatus -q '.mergeable + " / " + .mergeStateStatus'
git diff main...ci/gate-deploy-on-preview-e2e --name-only
```

Expected: checks pass, `MERGEABLE / CLEAN`, and only the two `.github/workflows/` files listed.

- [ ] **Step 2: Merge**

Squash, matching this repo's existing `(#N)` history.

```bash
gh pr merge 7 --squash --delete-branch
```

- [ ] **Step 3: Watch the first real gated deploy**

This is the first time the gate runs on a genuine push to main rather than a dispatch.

```bash
git checkout main && git pull --ff-only
sleep 30
RUN=$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" --exit-status; echo "watch_exit=$?"
gh run view "$RUN" --json jobs -q '.jobs[] | "\(.name)\t\(.conclusion)"'
```

Expected: `watch_exit=0`, `build` and `deploy` both `success`.

- [ ] **Step 4: Confirm the live site still serves**

```bash
sleep 30
curl -s -o /dev/null -w "site=%{http_code}\n" https://cameron-lewis.com/
curl -s -o /dev/null -w "brick_bom=%{http_code}\n" https://cameron-lewis.com/portfolio/assets/bom/brick-buck/IBOM.html
```

Expected: both `200`.

- [ ] **Step 5: Confirm e2e.yml did not double-run the bundle job on this push**

PR #7 added `if: github.event_name != 'push'` to `e2e-preview` precisely so main pushes do not pay for it twice.

```bash
E2E_RUN=$(gh run list --workflow e2e.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$E2E_RUN" --json jobs -q '.jobs[] | "\(.name)\t\(.conclusion)"'
```

Expected: `e2e` = `success`, and `e2e-preview` either absent or `skipped`. If `e2e-preview` ran, the `if` condition is wrong and every main push is paying twice.

---

## Deliberately Not Doing

**Pre-emptive flakiness mitigation.** A flaky bundle e2e now blocks deploys. The temptation is to raise `retries` from 1 to 2 immediately. That is speculative: there is no observed flake in this suite, and raising retries masks real intermittent failures as readily as it absorbs infrastructure noise. If a flake actually blocks a deploy, the escalation order is (1) raise CI retries to 2, (2) narrow the gating run to a smoke subset and leave the full suite in `e2e.yml`, (3) move it back to a parallel non-gating job. Revisit with evidence, not in advance.

**`concurrency` changes in `pages.yml`.** Longer `build` runs mean queued deploys serialize further apart. `cancel-in-progress: false` is correct for deploys — a cancelled deploy can leave Pages in a half-published state. Leave it.

---

## Self-Review

**Spec coverage.** Three issues were raised against PR #7. Issue 1, the gating path cannot be tested before merge: Tasks 1 and 2 cover both directions. Issue 2, flaky e2e blocks deploys: deliberately deferred with a written escalation path, above. Issue 3, Chromium install on every deploy: Task 3. Task 4 covers the merge itself and verifies the `e2e.yml` dedup that PR #7 introduced but never exercised.

**Placeholder scan.** No TBDs. Every step carries a runnable command with an explicit expected result and a stated failure action. The only code block that is not a command is the temporary Playwright assertion in Task 1 Step 3, given verbatim.

**Type consistency.** Step names are used identically across tasks: `Install Chromium` (created by PR #7, replaced in Task 3 Step 2), `E2E against the production bundle` (asserted by name in Task 2 Step 5 and Task 3 Step 4), `Upload artifact` (asserted in Task 3 Step 4). Branch names are consistent: `ci/gate-deploy-on-preview-e2e` is the PR branch throughout, `ci/prove-gate-fails-closed` is scratch-only and deleted within Task 1.

**Known ordering dependency.** Task 1 must precede Task 2. Task 1 carries zero deploy risk and would catch a non-blocking gate before any deploy happens; running Task 2 first would publish before the gate's blocking behaviour is proven.
