/**
 * inspectLayout — DOM layout diagnostic engine.
 *
 * Extracted from android-device-manager/scripts/inspect-layout.mjs.
 * Returns a structured report; rendering is the caller's concern (see renderLayoutReport).
 */

import { chromium } from 'playwright';
import { describeElement } from './utils/describe.mjs';

const DEFAULT_VIEWPORT_HEIGHT = 800;
const DEFAULT_WAIT_MS = 4000;
const DEFAULT_GOTO_TIMEOUT_MS = 60000;

/**
 * @typedef {Object} WideEntry
 * @property {string} desc
 * @property {number} width
 * @property {string} display
 * @property {string} minWidth
 * @property {number} offsetLeft
 */

/**
 * @typedef {Object} GridEntry
 * @property {string} desc
 * @property {number} width
 * @property {string} templateColumns
 * @property {number} children
 */

/**
 * @typedef {Object} SelectorEntry
 * @property {string} desc
 * @property {number} width
 * @property {string} display
 * @property {string} minWidth
 * @property {string} padding
 * @property {string|null} gridTemplateColumns
 * @property {string|null} flexDirection
 */

/**
 * @typedef {Object} LayoutReport
 * @property {number} vw
 * @property {number} vh
 * @property {number} scrollW
 * @property {number} scrollH
 * @property {WideEntry[]} wide
 * @property {GridEntry[]} grids
 * @property {{ selector: string, count: number, entries: SelectorEntry[] }[]} selectorResults
 */

/**
 * Run layout inspection inside the browser context.
 * This runs `page.evaluate()` — the describe helper is inlined below because it
 * must be defined in the browser context, not the library module.
 *
 * @param {import('playwright').Page} page
 * @param {string[]|null} selectors
 * @returns {Promise<LayoutReport>}
 */
export async function inspectPage(page, selectors) {
  return page.evaluate((selectors) => {
    function describe(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string'
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
      const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
      return `<${tag}${id}${cls}${role}>`;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrollW = document.documentElement.scrollWidth;
    const scrollH = document.documentElement.scrollHeight;

    const wide = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const w = el.offsetWidth;
      if (w > vw) {
        const s = getComputedStyle(el);
        wide.push({
          desc: describe(el),
          width: w,
          display: s.display,
          minWidth: s.minWidth,
          offsetLeft: el.offsetLeft,
        });
      }
    }
    wide.sort((a, b) => b.width - a.width);

    const grids = [];
    for (const el of all) {
      const s = getComputedStyle(el);
      if (s.display === 'grid' || s.display === 'inline-grid') {
        grids.push({
          desc: describe(el),
          width: el.offsetWidth,
          templateColumns: s.gridTemplateColumns,
          children: el.children.length,
        });
      }
    }

    const selectorResults = [];
    if (selectors) {
      for (const sel of selectors) {
        const matches = document.querySelectorAll(sel);
        const entries = [];
        for (const el of matches) {
          const s = getComputedStyle(el);
          entries.push({
            desc: describe(el),
            width: el.offsetWidth,
            display: s.display,
            minWidth: s.minWidth,
            padding: s.padding,
            gridTemplateColumns: s.display.includes('grid') ? s.gridTemplateColumns : null,
            flexDirection: s.display.includes('flex') ? s.flexDirection : null,
          });
        }
        selectorResults.push({ selector: sel, count: matches.length, entries });
      }
    }

    return { vw, vh, scrollW, scrollH, wide, grids, selectorResults };
  }, selectors);
}

/**
 * Render a LayoutReport to stdout in the UDM legacy format.
 *
 * @param {string} url
 * @param {number} width
 * @param {LayoutReport} report
 * @param {{ wide: number, grids: number }} limits
 * @param {(msg: string) => void} [log]
 */
export function renderLayoutReport(url, width, report, limits, log = console.log) {
  const { vw, scrollW, scrollH, wide, grids, selectorResults } = report;
  log(`\nInspecting ${url} at ${width}px\n`);

  log('Overflow:');
  log(`  scrollWidth=${scrollW}  innerWidth=${vw}  scrollHeight=${scrollH}`);
  if (scrollW > vw) {
    log(`  WARN: horizontal overflow by ${scrollW - vw}px`);
  } else {
    log(`  OK: no horizontal overflow`);
  }
  log('');

  if (wide.length) {
    log(`Elements wider than viewport (${wide.length} total, showing top ${Math.min(wide.length, limits.wide)}):`);
    for (const w of wide.slice(0, limits.wide)) {
      log(`  ${w.desc}  width=${w.width}  display=${w.display}  minWidth=${w.minWidth}  offsetLeft=${w.offsetLeft}`);
    }
    log('');
  } else {
    log('Elements wider than viewport: none\n');
  }

  if (grids.length) {
    log(`Grid containers (${grids.length} total, showing first ${Math.min(grids.length, limits.grids)}):`);
    for (const g of grids.slice(0, limits.grids)) {
      log(`  ${g.desc}  width=${g.width}  children=${g.children}  template-columns="${g.templateColumns}"`);
    }
    log('');
  }

  if (selectorResults.length) {
    log('Custom selectors:');
    for (const r of selectorResults) {
      log(`  ${r.selector}  (${r.count} match${r.count === 1 ? '' : 'es'})`);
      for (const e of r.entries) {
        const parts = [
          `width=${e.width}`,
          `display=${e.display}`,
          `minWidth=${e.minWidth}`,
          `padding=${e.padding}`,
        ];
        if (e.gridTemplateColumns) parts.push(`grid-template-columns="${e.gridTemplateColumns}"`);
        if (e.flexDirection) parts.push(`flex-direction=${e.flexDirection}`);
        log(`    ${e.desc}  ${parts.join('  ')}`);
      }
    }
    log('');
  }
}

/**
 * @typedef {Object} InspectOptions
 * @property {string} baseUrl
 * @property {string} path                      Full path starting with /.
 * @property {number} width
 * @property {boolean} [needsAuth]              Default true.
 * @property {(browser: import('playwright').Browser, baseUrl: string) => Promise<object>} [authenticate]
 *                                              Required if needsAuth is true.
 * @property {string[]|null} [selectors]
 * @property {{ wide: number, grids: number }} [limits] Default { wide: 10, grids: 15 }.
 * @property {number} [viewportHeight]
 * @property {number} [waitMs]
 * @property {number} [gotoTimeoutMs]
 * @property {(page: import('playwright').Page, ctx: { path: string, width: number, baseUrl: string }) => Promise<void>} [setup]
 *                                              Runs after navigation + waitMs, before DOM extraction.
 *                                              Use for tabbed pages, dialogs, or any state-dependent UI
 *                                              that must be driven into a non-default state before
 *                                              inspection. Mirrors captureScreenshots' setup contract.
 * @property {(msg: string) => void} [log]
 * @property {boolean} [print]                  Default true. If false, returns report without printing.
 */

/**
 * Run inspectPage against a URL. Launches + tears down its own browser.
 *
 * @param {InspectOptions} opts
 * @returns {Promise<{ report: LayoutReport, url: string }>}
 */
export async function inspectLayout(opts) {
  const {
    baseUrl,
    path,
    width,
    needsAuth = true,
    authenticate,
    selectors = null,
    limits = { wide: 10, grids: 15 },
    viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
    waitMs = DEFAULT_WAIT_MS,
    gotoTimeoutMs = DEFAULT_GOTO_TIMEOUT_MS,
    setup,
    log = console.log,
    print = true,
  } = opts;

  if (!path || !path.startsWith('/')) {
    throw new Error(`inspect path must start with /, got ${JSON.stringify(path)}`);
  }
  if (!Number.isFinite(width) || width < 200) {
    throw new Error(`width must be a number >= 200, got ${width}`);
  }
  if (needsAuth && typeof authenticate !== 'function') {
    throw new Error('authenticate adapter is required when needsAuth is true');
  }

  const browser = await chromium.launch();
  let storageState;
  try {
    if (needsAuth) {
      log(`Authenticating against ${baseUrl}...`);
      storageState = await authenticate(browser, baseUrl);
    }

    const context = await browser.newContext({
      viewport: { width, height: viewportHeight },
      storageState,
    });
    const page = await context.newPage();
    const url = `${baseUrl}${path}`;

    try {
      await page.goto(url, { waitUntil: 'load', timeout: gotoTimeoutMs });
      await page.waitForTimeout(waitMs);
      if (typeof setup === 'function') {
        await setup(page, { path, width, baseUrl });
      }
      const report = await inspectPage(page, selectors);
      if (print) {
        renderLayoutReport(url, width, report, limits, log);
      }
      return { report, url };
    } finally {
      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
