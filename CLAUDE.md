# @sptk-epb/visual-audit — CLAUDE.md

Shared Playwright visual-audit library. Consumed by all SPTK-EPB web projects via
`git+https://github.com/SPTK-EPB/sptk-visual-audit.git`. Exports screenshot capture,
DOM layout inspection, and overflow detection. Each consumer provides an auth adapter
and page registry — the library owns the pipeline, consumers own the auth.

## Commands

```bash
bun install                        # Install dev deps (playwright included as devDep)
bunx playwright install chromium   # Install Chromium (required post-install)
bun test                           # Run tests (node --test src/**/*.test.mjs)
node --check src/**/*.mjs          # Syntax check (CI gate)
node -e "import('./src/index.mjs').then(m => console.log(Object.keys(m)))"
                                   # Import smoke test (CI gate)
```

**Local iteration with a consumer**: `npm link` in this repo, then
`npm link @sptk-epb/visual-audit` in the consumer. Or push changes to `main` and
run `npm install @sptk-epb/visual-audit` in the consumer (lockfile-only bump, no
version change needed).

## Stack

Node.js 22+ (required; see `engines` in package.json), Playwright 1.45+ (peer dep),
ESM only (`.mjs` throughout), JSDoc for types (no TypeScript, no tsc step).
Bun for development; consumers may use Bun or Node to run the library.

## Project Layout

```
src/index.mjs          Public API — re-exports only. This is the API surface.
src/capture.mjs        captureScreenshots() — multi-viewport screenshot engine
src/inspect.mjs        inspectLayout() — DOM overflow/grid/selector diagnostic
src/utils/overflow.mjs detectOverflow(page) — horizontal overflow detection
src/utils/describe.mjs describeElement(el) — element descriptor for page.evaluate()
src/utils/png-dimensions.mjs  readPngDimensions(path)
docs/ADAPTER.md        Auth adapter + page registry contract + examples
AGENTS.md              Agent-readable project overview and conventions
```

## Critical Rules

1. **Public API stability** — `src/index.mjs` exports are the API surface. Adding a
   new export is safe. Renaming or removing any export is a breaking change that
   immediately breaks every consumer's audit scripts. Changes to function signatures
   (`opts` field renames, removed options, changed defaults) are also breaking.

2. **Git-ref consumption — no semver releases** — consumers install via
   `npm install git+https://github.com/SPTK-EPB/sptk-visual-audit.git`. There is no
   npm registry publication. Pushing to `main` is the release. Consumers update by
   running `npm install @sptk-epb/visual-audit` in their repo — this bumps only the
   lockfile (resolved SHA), `package.json` stays unchanged. Never bump the `version`
   field in `package.json` as a release mechanism.

3. **Repo must stay public** — consumers' CI pulls via `git+https`. Private repos
   fail in CI with `Permission denied (publickey)` because npm rewrites the URL to
   `git+ssh://` in the lockfile. See the `private-git+https-breaks-CI` learned rule.

4. **Breaking changes require coordinated rollout** — before merging: (a) file an
   issue labeled `breaking-change`, (b) open PRs across all active adopters (see
   Adopters table below), (c) merge adopter PRs first or simultaneously.

5. **No project-specific logic** — the library must remain generic. Auth adapters,
   page registries, fixture seeding, and project-specific CSS selectors live in the
   consumer repo, not here.

## Adopters

| Repo | Status | Issue |
|------|--------|-------|
| android-device-manager | Phase 1.b — in progress | [#197](https://github.com/SPTK-EPB/android-device-manager/issues/197) |
| dugnad-dashboard | Phase 2 — pending | [#28](https://github.com/SPTK-EPB/dugnad-dashboard/issues/28) |
| smie | Phase 2 — pending | [#67](https://github.com/SPTK-EPB/smie/issues/67) |

Rollout tracked at [command-center#76](https://github.com/SPTK-EPB/command-center/issues/76).

## Boundaries

### Ask first
- Adding new options to `captureScreenshots` or `inspectLayout` (API surface)
- Adding new exports to `src/index.mjs`
- Changing `fullPageMode` defaults (every consumer is affected)
- Adding npm dependencies (keeps the dep surface minimal for consumers)
- Changes to `docs/ADAPTER.md` (consumers rely on the adapter contract)

### Never
- Remove or rename existing exports from `src/index.mjs` without a breaking-change issue
- Add project-specific logic (auth flows, fixture seeding, per-project selectors)
- Commit `node_modules/` or any consumer secrets
- Force push
- Make the repo private
