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

## 2026-04-19 — Playwright as peer dependency

- **Decision**: Declare Playwright as a peer dependency, not a regular dependency.
- **Rationale**: Consumers are already pulling in Playwright (or planning to). Making it a peer dep means they pin the version. Avoids version-mismatch issues where the library pulls in Playwright 1.45 while the consumer has 1.50 and types drift.
- **Tags**: dependencies, peer-dep
