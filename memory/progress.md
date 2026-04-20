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
