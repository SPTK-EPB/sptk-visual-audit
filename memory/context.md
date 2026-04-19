# sptk-visual-audit — Context

> Shared Playwright visual-audit library. Consumed by SPTK-EPB web projects.

## Overview

- **Repo**: `SPTK-EPB/sptk-visual-audit`
- **Type**: Tool / shared library
- **Stack**: Node.js 22+ / Bun, ESM only, Playwright (peer dep), JSDoc
- **Status**: Phase 1.a — library extracted from UDM, awaiting consumer wiring
- **Live**: N/A (library, not a service)

## Architecture

```text
src/index.mjs          → public API re-exports
src/capture.mjs        → captureScreenshots(opts) — multi-viewport screenshot engine
src/inspect.mjs        → inspectLayout(opts) + inspectPage() + renderLayoutReport()
src/utils/overflow.mjs → detectOverflow(page)
src/utils/describe.mjs → describeElement(el) — for use inside page.evaluate()
docs/ADAPTER.md        → adapter contract + examples
```

Library is pure: no CLI, no filesystem writes outside `outDir`, no env var reads.
Auth is an adapter the consumer provides.

## Key Files

| File | Purpose |
| ---- | ------- |
| `src/capture.mjs` | Capture pipeline — launches browser, iterates viewports×pages, captures + archives + warns |
| `src/inspect.mjs` | Layout diagnostic — runs `page.evaluate()` for overflow/grid/selector inspection |
| `src/utils/describe.mjs` | Element descriptor helper — used inside `page.evaluate()`, duplicated inline in inspect.mjs |
| `docs/ADAPTER.md` | Adapter contract documentation |
| `AGENTS.md` | Project overview for coding agents |
| `.github/copilot-instructions.md` | Critical rules for Copilot |

## Consumers

Phase 1.a (initial landing — no consumers wired yet):

- **UDM** (android-device-manager) — pending Phase 1.b wire-up

Phase 4 (planned):

- dugnad-dashboard, smie, agent-obs — any web project that needs responsive audits

## Agent HQ Status

Set up at bootstrap (session 522):

- AGENTS.md (project overview, conventions, boundaries)
- `.github/copilot-instructions.md` (critical rules)
- `.github/workflows/ci.yml` (node --check + import smoke test)
- `.github/dependabot.yml` (github-actions weekly)
- `.github/pull_request_template.md` (adapter-contract impact checklist)
- memory/ scaffolded from CC template

Not set up yet:

- Copilot MCP config (add when needed)
- Targeted `.github/instructions/*.instructions.md` (add when patterns emerge)
- Tests (Phase 1 correctness is proven by end-to-end run through UDM)
