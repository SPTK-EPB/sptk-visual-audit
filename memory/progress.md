# sptk-visual-audit — Progress

> Completed work log. Append new entries at the bottom.
> When this file exceeds ~200 lines, archive older entries to `archive/progress-YYYY-MM.md`.

## 2026-04-19 — Phase 1.a bootstrap (CC session 522)

Extracted UDM's responsive-audit tooling into a shared library. Landed from
[command-center#76](https://github.com/SPTK-EPB/command-center/issues/76),
which captured the class of problems (tabbed pages, empty-state-only captures,
drift across per-project scripts) discovered in ADM session 411.

**Shipped:**

- Repo created (`SPTK-EPB/sptk-visual-audit`, private)
- Library source extracted from UDM:
  - `src/capture.mjs` — `captureScreenshots(opts)` engine
  - `src/inspect.mjs` — `inspectLayout(opts)` + `inspectPage()` + `renderLayoutReport()`
  - `src/utils/overflow.mjs` — `detectOverflow(page)`
  - `src/utils/describe.mjs` — `describeElement(el)`
  - `src/index.mjs` — public re-exports
- Adapter contract documented in `docs/ADAPTER.md`
- README with install + usage examples
- AGENTS.md + `.github/copilot-instructions.md`
- CI (`node --check` + import smoke test)
- Dependabot (github-actions weekly)
- Memory scaffolded from CC template

**Deferred to Phase 1.b (UDM workspace):**

- UDM consumes `@sptk-epb/visual-audit` via git dep
- UDM's `scripts/capture-screenshots.mjs` + `scripts/inspect-layout.mjs` become thin
  wrappers that import from the new package and supply UDM's auth adapter + PAGES registry
- UDM's `scripts/lib/playwright-auth.mjs` stays in UDM (auth adapter, not library code)
- End-to-end verification: one UDM page audited via the new library produces the
  same PNG output as the pre-extraction script

**Design decisions:**

- `.mjs` + JSDoc, no TypeScript build step (zero-friction consumer)
- Library owns pure engines; auth and page registry are adapter inputs
- No CLI in this repo — each consumer wraps the library in its own script
- Playwright as a peer dependency (consumers install + pin)

## 2026-04-20 — Library adoption friction fixes (session 1)

First focused session on this repo. Closed two docs/tooling issues that
preempt adopter confusion during Phase 1.b wire-up.

**Shipped:**

- **#6 closed** (`e798ee1`): `scripts/dev-setup.sh` + `AGENTS.md` Development
  section. One-command setup (`npm run setup`) installs deps + Chromium binary.
  Docs cover npm link for iterative consumer debugging and the lockfile-only
  bump pattern for shipping fixes.
- **#3 closed** (`4ba2f57`): README `Install` section restructured. Post-install
  `npx playwright install chromium` is now a dedicated subsection with the
  exact error consumers see when skipped, plus version-bump warning.
- `bun.lock` added to `.gitignore` (committed lockfile is `package-lock.json`
  to match CI's `npm install` step).

**Friction captured:**

- Chose `bun install` in dev-setup.sh first, then walked back to `npm install`
  after noticing CI uses npm. Staged as a learned-rule candidate: check
  `.github/workflows/ci.yml` + tracked lockfile before picking a dev-setup
  package manager.

**Open:**

- #4 — library-level retry-on-timeout for cold-compile first capture
- #5 — responsive audit defaults hide below-fold content on mobile viewports
- #1, #2 — Dependabot PRs (actions/checkout, setup-node 5→6), informational

## 2026-04-20 — Flipped fullPageMode default to 'mobile' (session 2)

Closed #5. `fullPageMode` default was `'large'` (full-page at desktop widths only),
which was backwards: mobile responsive audits need full-page most, and UDM had
already landed on `--full-page always` as a permanent override. Every future
adopter was going to hit the same wall.

**Shipped (`d80cc59`):**

- `src/capture.mjs`: default `'mobile'`. Added explicit `'desktop'` mode (full-page
  at 1024+). Kept `'large'` as silent alias for `'desktop'`. Updated JSDoc.
- `README.md` usage example shows `'mobile'` with inline mode semantics.
- Project pattern rule added in `.claude/rules/` + `.github/instructions/` mirror.
- Decision logged in `memory/decisions.md`.
- Verified semantics with inline truth-table (5 modes × 4 widths), CI green in 9s.

**Open:**

- #4 — library-level retry-on-timeout
- #1, #2 — Dependabot PRs
- Tests still not bootstrapped; the shipped change was covered by an inline node -e
  truth table, not a committed regression test.

## 2026-04-20 — Library-level warmup for cold-compile (session 3)

Closed #4. Issue body explicitly recommended `warm-up only, default on` over retry
— retry hides genuine capture issues (slow auth, content race, overloaded dev
server), while warmup targets the actual root cause (dev server cold compile on
first request). Pressure-tested the approach against alternatives (per-route
warmup, opt-in warmup, retry fallback, `waitUntil: 'commit'`) before implementing.

**Shipped:**

- `src/capture.mjs`: `warmup: boolean = true` + `warmupTimeoutMs: number = 60000`
  in `CaptureOptions`. One throwaway navigation to the first page's URL after
  `authenticate()` succeeds, before the viewport loop. Uses the capture-path
  auth context if the first page requires auth. Errors are swallowed with a
  warning; duration logged for diagnostic value (cold: 15-30s, warm: 1-3s).
- `README.md`: usage snippet shows `warmup: true` with inline guidance to pass
  `false` for production/staging URLs.
- `.claude/rules/sptk-visual-audit.md`: replaced "retry once before diagnosing"
  rule with "warmup is built-in — consumers shouldn't re-add retry wrappers".
  `.github/instructions/` mirror auto-synced.
- `[CC]` staged for ADM skill propagation — `responsive-audit-workflow` still
  documents the retry workaround.

**Verification:**

- `node --check` + import smoke test + `bun run test` (no committed tests, exits
  0 via `|| true`) all green. Real correctness proof comes during Phase 1.b UDM
  adoption.

**Open:**

- #1, #2 — Dependabot PRs (informational)
- Phase 1.b — UDM adoption (blocked on UDM workspace)
- Tests still not bootstrapped.

## 2026-04-20 — Sparse-capture heuristic overrides (session 4)

Closed #7. First adopter-discovered friction from dugnad-dashboard's Phase 2 run
— empty-state pages warned on every 1280px capture ("likely auth/nav race,
retry"). Pressure-tested the 4 options in the issue (per-page flag, global
threshold, actual retry, drop heuristic). Shipped issue-author's lean
(`minSizeKb` + `sparseOk`) with one simplification: `minSizeKb: number` not
`number | false` — `0` disables, positive number sets flat threshold. Kept the
default width heuristic for populated-page adopters (UDM).

**Shipped (`b181cc1`):**

- `src/capture.mjs`: per-page `sparseOk: true` (silence for legitimate
  empty-state pages) + global `minSizeKb: number` (flat threshold; `0` disables).
  Precedence: sparseOk > minSizeKb=0 > minSizeKb=N > built-in width heuristic.
  Rewrote warning message — dropped false "retry" promise; points adopters at
  the new override options.
- `README.md`: usage snippet shows `minSizeKb` with semantics comments;
  `sparseOk` example on a `PAGES` registry block; explicit precedence note.
- `.claude/rules/sptk-visual-audit.md` + `.github/instructions/` mirror: new
  "Sparse-capture heuristic: tune, don't default to off" section. Guards
  against future "just disable it" temptations by pointing at per-page
  `sparseOk` as the preferred fix.

**Verification:**

- `node --check` + import smoke green.
- Inline 11-case decision-table test covers: width heuristic (4 widths ×
  above/below threshold), `minSizeKb: 0` (disabled), flat threshold
  (above/below/vs-heuristic-divergence), and `sparseOk` precedence. All pass.
- CI green in 10s on first push.

**Process notes:**

- Clean first-try execution. Plan → API proposal (CLAUDE.md ask-first boundary)
  → `/recommend` simplification → edits → test → commit. Zero retries.
- Third consecutive session (#5 → #4 → #7) using inline `node -e` decision-table
  smoke tests in lieu of committed regression tests. Pattern is working —
  formal tests remain in `memory/tasks.md` TODO list.
- No new `[CC]` or `[MCP-GAP]` items; existing staging preserved for CC pickup.

**Open:**

- #8 (docs — Pattern B in ADAPTER.md, unblocks Smie)
- #9 (ad-hoc URL paths with query strings)
- #10 (inspect-layout `--setup` flag parity)
- #11 (compareScreenshots pixelmatch wrapper)
- #1, #2 — Dependabot PRs
- Tests still not bootstrapped.
