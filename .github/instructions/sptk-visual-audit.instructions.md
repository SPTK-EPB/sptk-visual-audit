<!-- Generated from .claude/rules/sptk-visual-audit.md by sync-rules-to-instructions.sh — do not edit directly -->
# sptk-visual-audit — Project Patterns

## Playwright peer dep: top-level import requires the consumer to have playwright installed

`src/capture.mjs` and `src/inspect.mjs` use top-level `import { chromium } from 'playwright'`.
This import resolves at module load, not at call time. Consumers that don't install
playwright as a dev dep will fail with `ERR_MODULE_NOT_FOUND` at import time — not at
capture time. Downstream CI failures look like import errors, not missing-binary errors.
When adding new top-level imports of peer deps, verify the CI smoke test (`.github/workflows/ci.yml`)
installs the dep before running the import check.

## `fullPageMode` default is `'mobile'` — mobile widths are the common full-page target

Below-fold content (empty-state panels, DataGrids, secondary sections) matters
most at narrow viewports where it's off-screen. `'mobile'` (default) captures
full-page below 1024px and viewport-only at 1024+; `'desktop'` inverts it;
`'always'` / `'never'` are unconditional. Legacy `'large'` is retained as a
silent alias for `'desktop'`. If an adopter wants full-page at every width
(UDM does), they pass `'always'` explicitly.

The default was `'large'` until [#5](https://github.com/SPTK-EPB/sptk-visual-audit/issues/5).
That default was backwards: mobile audits hit the below-fold wall first, while
desktop audits rarely need it. Don't flip the default again without a
coordinated rollout across all adopters listed in CLAUDE.md.

## Capture mode drift halts the batch — this is intentional

`captureScreenshots` throws if existing PNGs in `outDir` were captured in a different
mode (viewport vs full-page) than the current run. This prevents misleading before/after
pairs where one side is viewport-height and the other is full-page. Consumer workarounds:
`forceRearchive: true` (archive anyway), or `archive: false` (overwrite without archiving).
Do not weaken or remove this check — it is the only guard against silent mode-drift
comparisons in audit workflows. See `src/capture.mjs` `detectModeDrifts()`.

## Cold-compile warmup is built-in — consumers don't need retry wrappers

`captureScreenshots` performs a single throwaway navigation to the first page's
URL after authentication, before the viewport loop (`warmup: true` by default,
60s timeout). This lands the dev server's cold-compile cost outside the real
captures so capture-phase timeouts are unambiguous signals of a real problem
(slow auth, content race, dev server overloaded) rather than expected
first-hit latency. Closed by [#4](https://github.com/SPTK-EPB/sptk-visual-audit/issues/4).

Consumers should NOT re-add a try/catch retry wrapper around `captureScreenshots`
— warmup targets the root cause (cold compile) and retry would hide genuine
capture failures. If auditing production or pre-built URLs where no dev-server
compile occurs, pass `warmup: false` to skip the extra navigation.

## Library fix flow: fix here, bump lockfile in consumer

When a library bug is fixed: push to `main` → from the consumer repo, run
`npm install @sptk-epb/visual-audit` (no args). npm re-resolves the git ref and
updates only the lockfile (`package-lock.json` SHA changes, `package.json` unchanged).
Do NOT bump the `version` field in `package.json`. Do NOT `npm update` — it behaves
differently for git refs. If npm rewrites the dep entry to `github:SPTK-EPB/sptk-visual-audit`
shorthand, revert that chunk in `package.json` to keep the canonical `git+https://` form.

## Emoji / missing-font captures: strip overlays, don't change font config

On Linux CI runners without emoji fonts installed, Playwright renders emoji as
rectangular placeholder glyphs. This produces captures that look broken but are
correct representations of the CI environment. Do not add system font config to
the library — that belongs in the consumer's CI workflow. Similarly, Astro dev
toolbar and other `position:fixed` overlays tile across full-page captures (each
scroll-frame gets a copy). Strip fixed overlays in the consumer's per-page `setup`
hook: `await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove())`.
The library intentionally does not inject removal — it cannot know which overlays
are semantically important to a given project.

## Sparse-capture heuristic: tune, don't default to off

The width-based size heuristic (`minSizeForWidth`: 20KB ≤360, 30KB <640, 50KB
otherwise) catches auth redirects and content races where a capture completes
against the wrong page. It also false-positives on legitimately-sparse pages
(empty-state consumer dashboards, minimal marketing pages). Override precedence:
per-page `sparseOk: true` > global `minSizeKb: 0` (disable) > global `minSizeKb: N`
(flat threshold) > built-in width heuristic. The DEFAULT stays the width
heuristic — don't change the library default without a coordinated rollout
across adopters (the canary signal is valuable for populated-page audits like
UDM's). When fixing a false-positive, prefer per-page `sparseOk` over global
disable: keeps the signal live for the majority of pages. Closed by
[#7](https://github.com/SPTK-EPB/sptk-visual-audit/issues/7).

## `node --test` glob must be quoted in package.json

The test script is `"test": "node --test \"src/**/*.test.mjs\""` — the quotes
are load-bearing. Unquoted `src/**/*.test.mjs` gets expanded by POSIX sh before
Node sees it, and bash without `globstar` only matches 2 levels deep. That
misses `src/*.test.mjs` (e.g. `src/compare.test.mjs`). Quoting passes the
literal pattern through to Node, which does its own recursive glob expansion
(Node 21+). Don't "simplify" by dropping the quotes.

## Keep library generic: project logic stays in the adapter

The library provides: capture pipeline, overflow detection, layout inspection, PNG
archiving. Everything project-specific belongs in the consumer's adapter:
- Auth flows and credential management
- Page registry and route paths
- Fixture seeding or test-user creation
- Per-page `setup` hooks (clicking tabs, opening modals, selecting rows)
- CSS selectors for inspectLayout
- Output directory conventions and S3 archiving

If a feature request requires reading env vars, hardcoding selectors, or adding
project-specific branches to `capture.mjs` or `inspect.mjs`, it belongs in the
consumer, not the library.
