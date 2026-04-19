/**
 * captureScreenshots — authenticated multi-viewport screenshot engine.
 *
 * Extracted from android-device-manager/scripts/capture-screenshots.mjs (session 411).
 * Library owns the capture pipeline; consumers own the auth adapter and page registry.
 *
 * Adapter contract:
 *   authenticate(browser, baseUrl) => Promise<StorageState>
 *   pages: Record<string, { path: string, auth?: boolean, setup?: (page, ctx) => Promise<void> }>
 */

import { chromium } from 'playwright';
import { mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { detectOverflow } from './utils/overflow.mjs';
import { readPngDimensions } from './utils/png-dimensions.mjs';

const DEFAULT_VIEWPORT_HEIGHT = 800;
const DEFAULT_WAIT_MS = 4000;
const DEFAULT_GOTO_TIMEOUT_MS = 30000;
const FULL_PAGE_MODES = new Set(['always', 'never', 'large']);
const MODE_DRIFT_HEIGHT_RATIO = 1.2;

function shouldCaptureFullPage(mode, width) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return width >= 1024; // 'large' (default)
}

function minSizeForWidth(width) {
  if (width <= 360) return 20 * 1024;
  if (width < 640) return 30 * 1024;
  return 50 * 1024;
}

/**
 * Classify an existing PNG's capture mode from its height relative to the viewport.
 * Viewport-only captures are ~viewportHeight tall; full-page captures are typically
 * 1.5-10× taller. Heights within 20% of viewportHeight are treated as viewport-mode.
 */
function classifyExistingMode(pngHeight, viewportHeight) {
  return pngHeight > viewportHeight * MODE_DRIFT_HEIGHT_RATIO ? 'fullpage' : 'viewport';
}

async function detectModeDrifts({ pages, viewports, outDir, fullPageMode, viewportHeight }) {
  const drifts = [];
  for (const width of viewports) {
    const thisRunMode = shouldCaptureFullPage(fullPageMode, width) ? 'fullpage' : 'viewport';
    for (const [name] of Object.entries(pages)) {
      const filename = `${name}-${width}.png`;
      const filepath = join(outDir, filename);
      const existing = await stat(filepath).catch(() => null);
      if (!existing) continue;
      try {
        const { height } = await readPngDimensions(filepath);
        const existingMode = classifyExistingMode(height, viewportHeight);
        if (existingMode !== thisRunMode) {
          drifts.push({ filename, existingMode, existingHeight: height, newMode: thisRunMode });
        }
      } catch {
        // Unreadable PNG or non-PNG — skip drift detection for this file.
      }
    }
  }
  return drifts;
}

/**
 * @typedef {Object} PageConfig
 * @property {string} path
 * @property {boolean} [auth]           If false, capture without storageState.
 * @property {(page: import('playwright').Page, ctx: { name: string, width: number, baseUrl: string }) => Promise<void>} [setup]
 */

/**
 * @typedef {Object} CaptureOptions
 * @property {string} baseUrl
 * @property {number[]} viewports               Widths, e.g. [360, 1280].
 * @property {Record<string, PageConfig>} pages Page registry.
 * @property {(browser: import('playwright').Browser, baseUrl: string) => Promise<object>} authenticate
 *                                              Returns Playwright storageState.
 * @property {string} outDir                    Output directory for PNGs.
 * @property {'always'|'never'|'large'} [fullPageMode] Default 'large'.
 * @property {boolean} [archive]                Default true. Renames existing png → <name>-before.png.
 * @property {boolean} [forceRearchive]         Default false. Archive even when existing capture
 *                                              mode (viewport vs full-page) differs from this run.
 *                                              Without it, mode drift halts the batch.
 * @property {number} [viewportHeight]          Default 800.
 * @property {number} [waitMs]                  Default 4000.
 * @property {number} [gotoTimeoutMs]           Default 30000.
 * @property {(page: import('playwright').Page, ctx: { name: string, width: number, baseUrl: string }) => Promise<void>} [setup]
 *                                              Global per-viewport setup (page-level setup wins).
 * @property {(msg: string) => void} [log]      Default console.log.
 * @property {(msg: string) => void} [warn]     Default console.warn.
 * @property {(msg: string) => void} [error]    Default console.error.
 */

/**
 * Run the capture pipeline. Returns a summary.
 *
 * @param {CaptureOptions} opts
 * @returns {Promise<{ captured: number, failed: number, overflowWarnings: number, sizeWarnings: number, outDir: string }>}
 */
export async function captureScreenshots(opts) {
  const {
    baseUrl,
    viewports,
    pages,
    authenticate,
    outDir,
    fullPageMode = 'large',
    archive = true,
    forceRearchive = false,
    viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
    waitMs = DEFAULT_WAIT_MS,
    gotoTimeoutMs = DEFAULT_GOTO_TIMEOUT_MS,
    setup: globalSetup,
    log = console.log,
    warn = console.warn,
    error = console.error,
  } = opts;

  if (!FULL_PAGE_MODES.has(fullPageMode)) {
    throw new Error(`fullPageMode must be one of: ${[...FULL_PAGE_MODES].join(', ')}`);
  }
  if (!Array.isArray(viewports) || viewports.length === 0) {
    throw new Error('viewports must be a non-empty number[]');
  }
  if (!pages || typeof pages !== 'object') {
    throw new Error('pages registry is required');
  }
  if (typeof authenticate !== 'function') {
    throw new Error('authenticate adapter is required');
  }

  await mkdir(outDir, { recursive: true });

  if (archive && !forceRearchive) {
    const drifts = await detectModeDrifts({ pages, viewports, outDir, fullPageMode, viewportHeight });
    if (drifts.length > 0) {
      error(`\nCapture mode drift detected in ${drifts.length} file(s):`);
      for (const d of drifts) {
        error(`  ${d.filename} — existing=${d.existingMode} (height=${d.existingHeight}px), this run=${d.newMode}`);
      }
      error(`\nArchive would produce misleading before/after pairs. Choose one:`);
      error(`  --force-rearchive    Archive anyway (existing → -before.png).`);
      error(`  --no-archive         Skip archiving (overwrite current without creating -before).`);
      error(``);
      throw new Error(`Capture halted: mode drift detected in ${drifts.length} file(s).`);
    }
  }

  const browser = await chromium.launch();

  log(`\nAuthenticating against ${baseUrl}...`);
  const storageState = await authenticate(browser, baseUrl);
  log(`Authenticated.\n`);

  const pageEntries = Object.entries(pages);

  let captured = 0;
  let failed = 0;
  let overflowWarnings = 0;
  let sizeWarnings = 0;

  try {
    for (const width of viewports) {
      const authedContext = await browser.newContext({
        viewport: { width, height: viewportHeight },
        storageState,
      });
      const anonContext = await browser.newContext({
        viewport: { width, height: viewportHeight },
      });

      for (const [name, config] of pageEntries) {
        const needsAuth = config.auth !== false;
        const context = needsAuth ? authedContext : anonContext;
        const url = `${baseUrl}${config.path}`;
        const filename = `${name}-${width}.png`;
        const filepath = join(outDir, filename);
        const pageSetup = typeof config.setup === 'function' ? config.setup : null;
        const setupFn = pageSetup ?? globalSetup ?? null;

        try {
          if (archive) {
            const beforePath = filepath.replace(/\.png$/, '-before.png');
            const existing = await stat(filepath).catch(() => null);
            if (existing) {
              const beforeExists = await stat(beforePath).catch(() => null);
              if (!beforeExists) {
                await rename(filepath, beforePath);
              }
            }
          }

          const page = await context.newPage();
          await page.goto(url, { waitUntil: 'load', timeout: gotoTimeoutMs });
          await page.waitForTimeout(waitMs);

          if (setupFn) {
            await setupFn(page, { name, width, baseUrl });
          }

          const { scrollWidth, innerWidth, overflow } = await detectOverflow(page);
          if (overflow) {
            warn(
              `  WARN: ${filename} — horizontal overflow (scrollWidth=${scrollWidth}, viewport=${innerWidth})`
            );
            overflowWarnings++;
          }

          await page.screenshot({
            path: filepath,
            fullPage: shouldCaptureFullPage(fullPageMode, width),
          });
          await page.close();

          const { size } = await stat(filepath);
          const minSize = minSizeForWidth(width);
          if (size < minSize) {
            warn(
              `  WARN: ${filename} — suspicious size (${Math.round(size / 1024)}KB < ${minSize / 1024}KB for ${width}px) — likely auth/nav race, retry`
            );
            sizeWarnings++;
          }

          log(`  ${filename}`);
          captured++;
        } catch (err) {
          error(`  ${filename} — FAILED: ${err.message}`);
          failed++;
        }
      }

      await authedContext.close();
      await anonContext.close();
    }
  } finally {
    await browser.close();
  }

  log(
    `\nDone: ${captured} captured, ${failed} failed, ${overflowWarnings} overflow warnings, ${sizeWarnings} size warnings`
  );
  log(`Output: ${outDir}\n`);

  return { captured, failed, overflowWarnings, sizeWarnings, outDir };
}
