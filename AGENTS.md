# AGENTS.md — @sptk-epb/visual-audit

Shared Playwright visual-audit library. This repo is consumed by SPTK-EPB web
projects to run authenticated screenshot captures and DOM layout inspection
during responsive-design audits.

## Project overview

- **Purpose**: single source of truth for visual-audit tooling across SPTK-EPB
  web projects (UDM, dugnad-dashboard, smie, agent-obs).
- **Runtime**: Node.js 22+ / Bun. ESM only (`type: "module"`).
- **Shape**: pure library — no CLI, no build step. JSDoc types, no `.ts`.
- **Peer dependencies**: Playwright 1.45+ (consumers install).
- **Consumer contract**: auth adapter + page registry (see `docs/ADAPTER.md`).

## Stack

- Node.js 22 / Bun (ESM)
- Playwright (chromium) as peer dependency
- JSDoc for types, no TypeScript build step

## Conventions

### File layout

```
src/
  index.mjs            # Public re-exports
  capture.mjs          # captureScreenshots() engine
  inspect.mjs          # inspectLayout() + inspectPage() + renderLayoutReport()
  utils/
    overflow.mjs       # detectOverflow(page)
    describe.mjs       # describeElement(el) — used inside page.evaluate()
docs/
  ADAPTER.md           # Adapter contract + examples
```

### Always

- **Read a sibling file before editing an engine.** `capture.mjs` and `inspect.mjs`
  share patterns (options defaulting, adapter invocation, error handling). When
  changing one, match the other.
- **JSDoc on every exported function.** Consumers read these as types.
- **Return a structured result, not just `void`.** `captureScreenshots` returns
  counts; `inspectLayout` returns `{ report, url }`. This enables scripting.
- **Clean up browser resources in `finally`.** Tests rely on clean teardown.
- **Keep engines pure.** No environment reads, no filesystem writes outside
  `outDir`, no hard-coded URLs.

### Never

- **Don't own auth logic.** Auth is project-specific. The library accepts an
  adapter; it never reaches for env vars, secrets files, or project-specific APIs.
- **Don't add a CLI to this repo.** The CLI is each consumer's concern — they
  wrap the library in their own `scripts/capture-screenshots.mjs` with project-
  specific defaults.
- **Don't add build tooling.** Ship `.mjs` with JSDoc. Consumers use it directly.
- **Don't introduce hard dependencies.** Every new dep becomes a consumer burden.
  Playwright is the only peer dep; keep it that way.

## Testing

No test suite yet. Phase 1 is a verbatim extract — correctness is proven by
running the UDM audit pipeline end-to-end against the library (Phase 1.b, in
the UDM workspace).

Future test plan:
- Smoke test: launch a local HTML fixture, run `captureScreenshots` against it,
  assert file counts and presence of overflow warnings when expected.
- Unit tests: `detectOverflow` and `describeElement` against a jsdom page.

## CI

`.github/workflows/ci.yml` runs:
- `node --check` on every `src/**/*.mjs` (syntax)
- (Future) `bun test` once tests are added

## Boundaries

### Ask first

- Adding dependencies (peer deps too)
- Changing the adapter contract (`authenticate` signature or `PageConfig` shape)
- Adding a build step

### Never

- Commit `.env` files or secrets
- Log auth credentials — the library does not redact, and consumers trust it
- Break the `exports` map in `package.json` (consumers pin specific subpaths)
- Modify `AGENTS.md` or `README.md` from automated refactors without human review

## References

- [command-center#76](https://github.com/SPTK-EPB/command-center/issues/76) — parent issue, phased rollout plan
- Upstream sources (pre-extraction):
  - `android-device-manager/scripts/capture-screenshots.mjs`
  - `android-device-manager/scripts/inspect-layout.mjs`
  - `android-device-manager/scripts/lib/playwright-auth.mjs` (kept in UDM as adapter)
