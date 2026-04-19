# sptk-visual-audit — Tasks

> Strategic backlog. Actionable work items are filed as GitHub Issues on
> `SPTK-EPB/sptk-visual-audit` — this file captures phases and direction.

## Active

### Phase 1.b — UDM adoption (blocked on UDM workspace)

- UDM consumes `@sptk-epb/visual-audit` via git dep
- UDM's `scripts/capture-screenshots.mjs` becomes a wrapper around `captureScreenshots`
- UDM's `scripts/inspect-layout.mjs` becomes a wrapper around `inspectLayout`
- UDM's `scripts/lib/playwright-auth.mjs` stays (it IS the adapter)
- Filed as UDM issue — see parent [command-center#76](https://github.com/SPTK-EPB/command-center/issues/76)

## Upcoming phases (from command-center#76)

### Phase 2 — Exhaustive tab walk (`--exhaustive`)

- Add `walkTabs(page, maxDepth=2)` — BFS through `[role=tablist]` → `[role=tab]`
- Capture each tab's active state, nested up to depth 2
- Filename convention: `<page>-<tab-slug-breadcrumb>-<width>.png`

### Phase 3 — Populated mode (`--mode=populated`)

- Add `seedFixtures(adapter, fixtureFiles)` with project-supplied seed function
- `--mode=both` runs empty + populated passes
- Separate local DB per project (e.g., `udm-audit.db`) to avoid polluting dev DB

### Phase 4 — CC-level skill promotion

- Move UDM's `responsive-audit-workflow` skill to CC-level
- File per-project adoption issues (dugnad-dashboard, smie, agent-obs)

### Phase 5 — Close duplicate per-project scripts

- Deprecate individual `capture-screenshots.mjs` files across repos
- Verify each consumer has migrated fully before removal

## Tests (not yet started)

- Smoke test: serve a local HTML fixture, run `captureScreenshots` against it,
  assert file counts + presence of overflow warnings when expected
- Unit tests: `detectOverflow` and `describeElement` against jsdom
- Adapter contract tests: fake `authenticate` that returns various
  storageState shapes, confirm library handles them
