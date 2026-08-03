# Task 10 Report — Sweep em dashes out of portfolio.ts

## Occurrences found (re-grepped, not taken on faith from the brief) and pattern applied

Ran `grep -n "—" src/app/src/app/data/portfolio.ts` before editing. Found 33 content occurrences plus 1 code occurrence (34 total, matching the brief's count):

| Line | Original | Pattern | Result |
|---|---|---|---|
| 202 | `period: "January 2026 — April 2026"` | 1 (date range → en dash, no spaces) | `"January 2026–April 2026"` |
| 217 | `company: "Paradigm Engineering — MUN Student Design Team"` | 2 (label/role → colon) | `"Paradigm Engineering: MUN Student Design Team"` |
| 221 | `period: "September 2025 — Present"` | 1 | `"September 2025–Present"` |
| 234 | `company: "Horizon Aerospace — MUN Student Rocketry Team"` | 2 | `"Horizon Aerospace: MUN Student Rocketry Team"` |
| 236 | `role: "Avionics — Electrical"` | 2 | `"Avionics: Electrical"` |
| 238 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 251 | `company: "Valiant Aerotech — MUN Student Design Team"` | 2 | `"Valiant Aerotech: MUN Student Design Team"` |
| 255 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 292 | `period: "2024 — Present"` | 1 | `"2024–Present"` |
| 296 | `highlights: ["Dean's List — 2024-2025", ...]` | 2 (label/date → colon, per brief Step 4) | `"Dean's List: 2024-2025"` |
| 301 | `period: "2018 — 2024"` | 1 | `"2018–2024"` |
| 310 | `"ECE-3300 — Circuits & Electronics"` | 2 (course code) | `"ECE-3300: Circuits & Electronics"` |
| 311 | `"ECE-3400 — Foundations of Programming (C++)"` | 2 | `"ECE-3400: Foundations of Programming (C++)"` |
| 312 | `"ECE-3500 — Digital Logic"` | 2 | `"ECE-3500: Digital Logic"` |
| 313 | `"PHYS-3000 — Physics of Device Materials"` | 2 | `"PHYS-3000: Physics of Device Materials"` |
| 314 | `"ENGI-1020 — Introduction to Programming (Python)"` | 2 | `"ENGI-1020: Introduction to Programming (Python)"` |
| 315 | `"ENGI-1030 — Graphics & 3D Design"` | 2 | `"ENGI-1030: Graphics & 3D Design"` |
| 316 | `"ENGI-1050 — Circuits"` | 2 | `"ENGI-1050: Circuits"` |
| 317 | `"MATH-2050 — Linear Algebra"` | 2 | `"MATH-2050: Linear Algebra"` |
| 501 | `period: "Jan 2026 — Present"` | 1 | `"Jan 2026–Present"` |
| 533 | `period: "Feb 2026 — Mar 2026"` | 1 | `"Feb 2026–Mar 2026"` |
| 568 | `period: "Mar 2026 — Present"` | 1 | `"Mar 2026–Present"` |
| 585 | `period: "Apr — May 2026"` | 1 | `"Apr–May 2026"` |
| 592 | `"Desoldered the capacitor ... board — powered it back on ..."` | 3 (prose → period, sentence split) | `"...board. Powered it back on..."` |
| 606 | `"...batteries — it worked perfectly on both. Later..."` | 3 | `"...batteries. It worked perfectly on both. Later..."` |
| 623 | `role: "Avionics — Electrical"` | 2 | `"Avionics: Electrical"` |
| 624 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 639 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 657 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 672 | `period: "Jun 2026 — Present"` | 1 | `"Jun 2026–Present"` |
| 689 | `period: "2025 — Present"` | 1 | `"2025–Present"` |
| 718 | `period: "2026 — Present"` | 1 | `"2026–Present"` |
| 740 | `period: "2024 — Present"` | 1 | `"2024–Present"` |
| 817 | `const token = period.split("—")[0].trim();` | code (not content) — parser must match the new separator | `period.split("–")[0].trim()` |

Line 817 wasn't in the brief's line list (the brief only covers content, described as "no exported shape changes"), but it's a helper function inside portfolio.ts (`parsePeriodStart`) that splits `period` strings on the literal em dash to derive a sort key. Since every `period:` field's separator was changed from em dash to en dash, this split had to be updated too or every `period` sort key would silently break (always returning the whole string as one un-splittable token, falling through to the year-only regex or 0). Fixed in the same commit since it's the same file and directly downstream of the content change.

All line numbers from the brief matched actual file content exactly — no drift found, so no judgment calls were needed beyond the line-817 parser fix above.

## Final verification

```
$ grep -n "—" src/app/src/app/data/portfolio.ts
(no output)
$ echo $?
1
```

Confirmed: zero em dashes remain.

## Build / typecheck

Ran `npx pnpm@latest build`:

```
vite v6.3.5 building for production...
✓ 2087 modules transformed.
✓ built in 1.99s
```

Build succeeded (only a pre-existing chunk-size warning, unrelated to this change).

Ran `npx pnpm@latest typecheck`:

```
$ tsc --build --force
```

Exit clean, no errors.

Note: original version of this section incorrectly claimed "No tsc/typecheck script exists in this repo," relying on stale CLAUDE.md wording instead of checking live repo state. Task 7 (merged before this task ran) had already added `"typecheck": "tsc --build --force"` to package.json. Should have grepped package.json directly rather than trusting doc text. Corrected in Fix round 1 below.

## Commit

```
877d310 content: remove em dashes from portfolio.ts per style rule
1 file changed, 34 insertions(+), 34 deletions(-)
```

Only `src/app/src/app/data/portfolio.ts` was touched, as scoped.

## Fix round 1

Reviewer finding: original report falsely stated "No tsc/typecheck script exists in this repo," based on stale CLAUDE.md text rather than checking package.json, which had already gained a `typecheck` script via Task 7 (merged before this task ran). No code defect — the portfolio.ts content changes were approved as correct. This round only corrects the report.

Ran `npx pnpm@latest typecheck` for real:

```
$ tsc --build --force
```

Exit code 0, no output, no errors. Confirms the em-dash-to-en-dash/colon content edits and the `period.split("—")` → `period.split("–")` parser fix in `parsePeriodStart` (line 817) are type-clean.

Changed: only this report file (`task-10-report.md`), correcting the "Build / typecheck" section. No source files touched.

Commit: report-only follow-up commit (see hash in final reply).
