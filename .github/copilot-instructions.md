# Copilot instructions — @sptk-epb/visual-audit

This is a shared Playwright visual-audit library. Read `AGENTS.md` for the full
project overview; this file surfaces the critical rules for Copilot.

## Critical rules

1. **ESM only.** Every file ends in `.mjs`. Imports use explicit extensions
   (`'./utils/overflow.mjs'`). No `.ts`, no default-export Node CJS.

2. **Library boundary.** No CLI in this repo. No filesystem writes outside
   `outDir`. No env var reads. Auth is an adapter the consumer passes in.

3. **Playwright is a peer dep.** Never `import` from `playwright` at module
   top-level except in engine files (`capture.mjs`, `inspect.mjs`). Utilities
   (`utils/overflow.mjs`, `utils/describe.mjs`) use Playwright types via JSDoc
   only — they run against a `Page` passed by the caller.

4. **Browser context code lives inside `page.evaluate()`.** Any function that
   reaches `document`/`window` must be re-defined inside the `evaluate` callback
   — module-level helpers are not available in the browser context.
   The `describeElement` utility exists as an npm export AND is duplicated inline
   inside `inspect.mjs`'s `page.evaluate()`. Keep them in sync when editing.

5. **Finally-block teardown.** Every engine that launches a browser closes it
   in a `finally`. Nested contexts also close in their own `finally`.

## Architecture

```
src/index.mjs          → re-exports the public surface
src/capture.mjs        → captureScreenshots(opts) engine
src/inspect.mjs        → inspectLayout(opts), inspectPage(page, selectors), renderLayoutReport(...)
src/utils/overflow.mjs → detectOverflow(page)
src/utils/describe.mjs → describeElement(el) — for use inside page.evaluate()
```

## Versioning

Pre-1.0. No public API stability guarantee — but every breaking change to
`captureScreenshots` or `inspectLayout` options needs a `BREAKING:` prefix in
the commit message and a README note.

## Testing

No suite yet. Phase 1 correctness is proven by wiring UDM to consume this
library and running the existing audit pipeline unchanged.

## Before submitting

- `node --check src/**/*.mjs` — syntax
- README + AGENTS.md reflect the change
- Option additions to `captureScreenshots` / `inspectLayout` documented with JSDoc

## What not to modify

- `package.json` `exports` map without human review — consumers pin these.
- The `authenticate(browser, baseUrl) => storageState` signature — consumers depend on it.
- `PageConfig` shape (`{ path, auth?, setup? }`) — same reason.
