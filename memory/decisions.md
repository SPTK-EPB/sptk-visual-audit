# sptk-visual-audit — Decisions

> Architectural and strategic decisions with rationale. Format:
>
> ## YYYY-MM-DD — {title}
>
> - **Decision**: What we chose
> - **Rationale**: Why
> - **Tags**: {comma-separated}

## 2026-04-19 — New repo over embedding in command-center/scripts/audit/

- **Decision**: Extract to dedicated repo `SPTK-EPB/sptk-visual-audit` rather than `command-center/scripts/audit/` with sibling-path invocation.
- **Rationale**: Library will be consumed by ≥4 projects (UDM, dugnad-dashboard, smie, agent-obs per the Phase 4 plan). Sibling-path invocation is fragile (breaks if CC not checked out locally, breaks in CI). New repo = `bun add git+https://…`, zero assumptions about filesystem layout. Upfront cost ~30 min vs. years of sprawl in CC scripts/.
- **Tags**: architecture, shared-lib, cross-project

## 2026-04-19 — ESM + JSDoc, no TypeScript build step

- **Decision**: Ship `.mjs` files with JSDoc type annotations rather than TypeScript with a build step.
- **Rationale**: Consumers are already `.mjs` (UDM's existing audit scripts). TypeScript adds a publish/build step and dual-package complexity for a ~400-line library. JSDoc gives consumers IntelliSense via `checkJs` without making the library a dependency with a `dist/`. Can migrate to TS later if pain emerges.
- **Tags**: tooling, build, dx

## 2026-04-19 — Library owns engines; consumers own auth adapter + page registry

- **Decision**: `captureScreenshots` and `inspectLayout` accept `authenticate` and `pages` as arguments rather than reading them from a global or config file.
- **Rationale**: Auth is project-specific (UDM hits `/api/auth/sign-up/email` and runs `wrangler d1 execute` — none of that generalizes). Page registries are project-specific too. Parameterizing both keeps the library pure and testable, and lets each project version its adapter independently.
- **Tags**: architecture, boundary, dependency-injection

## 2026-04-19 — No CLI in this repo

- **Decision**: Don't ship an `sptk-audit` CLI with this library. Each consumer wraps the library in its own project-local script (e.g., `scripts/capture-screenshots.mjs` in UDM).
- **Rationale**: CLI defaults are project-specific (local dev URL, output directory convention, staging env var names). A one-size-fits-all CLI would need every project's conventions baked in, or a heavy config system. A thin project-level wrapper is 10-20 lines and captures the right defaults.
- **Tags**: scope, api-surface

## 2026-04-20 — `fullPageMode` default flipped from `'large'` to `'mobile'`

- **Decision**: Default is `'mobile'` (full-page below 1024, viewport at 1024+). Added `'desktop'` as an explicit mode; kept `'large'` as a silent alias for `'desktop'`.
- **Rationale**: The original `'large'` default captured full-page at desktop widths and viewport-only at mobile widths — exactly backwards for the library's motivating use case (responsive audits of below-fold content at 360/414/768px). Every adopter was going to hit the same wall (UDM already landed on `--full-page always` as a permanent override). Flipping the default is cleaner than a convenience flag because it makes the pit of success match the pit of need. Ships pre-Phase-1.b so no live adopters break; UDM uses `'always'` explicitly and is unaffected.
- **Tags**: api-surface, defaults, responsive-audit
- **Issue**: [#5](https://github.com/SPTK-EPB/sptk-visual-audit/issues/5)

## 2026-04-20 — Warmup default-on, no retry fallback

- **Decision**: `captureScreenshots` does one throwaway navigation to the first page's URL after `authenticate()` succeeds (`warmup: true` by default). No retry-on-timeout is added as a fallback, even for captures that still time out after warmup.
- **Rationale**: Retry hides genuine capture issues (slow auth, content races, overloaded dev servers). Warmup targets the actual root cause (cold-compile on first request) without that cost. Consumers who previously wrapped `captureScreenshots` in a try/catch retry loop should remove that wrapper — their captures will be more trustworthy. Shared-module cold compile is ~80% of first-hit latency, so one warmup covers the common case; per-route incremental compile is seconds, not tens.
- **Tags**: api-surface, defaults, dev-experience
- **Issue**: [#4](https://github.com/SPTK-EPB/sptk-visual-audit/issues/4)

## 2026-04-19 — Playwright as peer dependency

- **Decision**: Declare Playwright as a peer dependency, not a regular dependency.
- **Rationale**: Consumers are already pulling in Playwright (or planning to). Making it a peer dep means they pin the version. Avoids version-mismatch issues where the library pulls in Playwright 1.45 while the consumer has 1.50 and types drift.
- **Tags**: dependencies, peer-dep
