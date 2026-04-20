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

## Cold-compile first-capture timeout: retry once before diagnosing

The first Playwright capture in a session against a Vite/Astro/Next.js dev server can
hit the `gotoTimeoutMs` (default 30s) because the dev server compiles on first request.
The fix is a single retry, not an increased timeout. Consumers should wrap `captureScreenshots`
in a try/catch and retry once on timeout errors. Library issue tracked at
[sptk-visual-audit#4](https://github.com/SPTK-EPB/sptk-visual-audit/issues/4). Until
library-level retry lands, document the consumer-side retry in the adapter.

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
