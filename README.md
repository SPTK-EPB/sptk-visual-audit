# @sptk-epb/visual-audit

Shared Playwright visual-audit library for SPTK-EPB web projects — screenshot
capture, DOM layout inspection, overflow detection.

Extracted from [android-device-manager](https://github.com/SPTK-EPB/android-device-manager)'s
`scripts/capture-screenshots.mjs` + `scripts/inspect-layout.mjs`. See
[command-center#76](https://github.com/SPTK-EPB/command-center/issues/76) for rationale.

## Install

Consume via git URL:

```bash
bun add git+https://github.com/SPTK-EPB/sptk-visual-audit.git
# or
npm install git+https://github.com/SPTK-EPB/sptk-visual-audit.git
```

Requires Playwright as a peer dependency:

```bash
bun add -d playwright
```

### Required post-install step

Playwright ships its browser binaries separately from the npm package. Run
this once after install **and again after every library upgrade**:

```bash
bunx playwright install chromium
# or: npx playwright install chromium
```

Skipping this step produces a failure on the first capture:

```
Looks like Playwright was just installed or updated.
Please run the following command to download new browsers:
  npx playwright install
```

This re-runs whenever the library bumps its Playwright peer-dep version —
the local Chromium cache is pinned to the previously-installed Playwright,
and a version mismatch invalidates it. If in doubt, re-run the command —
it's a no-op when the cache is already current.

## Usage

### Capture screenshots

```js
import { captureScreenshots } from '@sptk-epb/visual-audit';
import { authenticate, PAGES } from './audit/auth.mjs';

const result = await captureScreenshots({
  baseUrl: 'http://localhost:3000',
  viewports: [360, 1280],
  pages: PAGES,
  authenticate,
  outDir: './tmp/screenshots/2026-04-19',
  fullPageMode: 'mobile',  // 'mobile' (default) | 'desktop' | 'always' | 'never'
                           // 'mobile'  = full-page <1024px, viewport at 1024+
                           // 'desktop' = full-page at 1024+, viewport below
  archive: true,           // rename existing .png to -before.png
  warmup: true,            // default. One pre-loop navigation to warm dev-server
                           // cold compile. Set false for production/staging URLs.
  minSizeKb: undefined,    // undefined → width heuristic (20/30/50 KB by width).
                           // 0 → disable the sparse-capture check entirely.
                           // N → flat N-KB threshold at every width.
});
// → { captured, failed, overflowWarnings, sizeWarnings, outDir }
```

The sparse-capture heuristic warns when a PNG is under a size threshold — this
catches auth redirects and content races, but false-positives on legitimately
sparse pages (empty-state dashboards, minimal marketing pages). Per-page
`sparseOk: true` silences the warning on known-sparse pages without turning it
off globally:

```js
export const PAGES = {
  index:   { path: '/' },
  devices: { path: '/my/devices', sparseOk: true },  // empty-state dashboard
  apps:    { path: '/my/apps', sparseOk: true },     // empty-state dashboard
};
```

Precedence: per-page `sparseOk` > global `minSizeKb: 0` > global `minSizeKb: N` > built-in width heuristic.

### Inspect layout

```js
import { inspectLayout } from '@sptk-epb/visual-audit';
import { authenticate } from './audit/auth.mjs';

await inspectLayout({
  baseUrl: 'http://localhost:3000',
  path: '/dashboard/policies',
  width: 360,
  needsAuth: true,
  authenticate,
  selectors: ['main', '[role=grid]', 'header'],
  // Drive UI into a non-default state before inspection — tab clicks, dialogs,
  // row selection, etc. Mirrors captureScreenshots' setup contract.
  setup: async (page, { path, width, baseUrl }) => {
    await page.click('[role=tab][aria-label="Anomaly"]');
    await page.waitForSelector('[data-testid=anomaly-panel]');
  },
});
// Prints an overflow / wide-element / grid-container report to stdout.
```

## Adapter contract

Consumers provide two things:

1. **`authenticate(browser, baseUrl)`** — returns a Playwright `storageState`.
   Owns project-specific auth: API sign-in, cookie setup, D1 fixtures, etc.

2. **`pages`** — a registry mapping page keys to `{ path, auth?, setup? }`:

```js
export const PAGES = {
  signin:    { path: '/signin', auth: false },
  dashboard: { path: '/dashboard' },
  policies:  { path: '/dashboard/policies' },
  // Page-specific setup wins over the global setup.
  analytics: {
    path: '/dashboard/analytics',
    setup: async (page, { name, width, baseUrl }) => {
      await page.click('text=Last 7 days');
    },
  },
};
```

See [docs/ADAPTER.md](docs/ADAPTER.md) for the full contract + examples.

## Roadmap

This is the Phase 1 library extraction. Upcoming work tracked in
[command-center#76](https://github.com/SPTK-EPB/command-center/issues/76):

- **Phase 2**: `--exhaustive` tab walk (BFS through `[role=tablist]`)
- **Phase 3**: `--mode=populated` with fixture seeding
- **Phase 4**: CC-level `responsive-audit-workflow` skill + per-project adoption
- **Phase 5**: Close duplicate per-project capture scripts

## Related

- [Phase 1.b — UDM consumption issue](https://github.com/SPTK-EPB/android-device-manager/issues) (to be filed)
- `.claude/skills/responsive-audit-workflow` (UDM, to promote to CC in Phase 4)
- `.claude/skills/playwright-visual-testing` (CC, already exists — patterns reference)
