/**
 * @sptk-epb/visual-audit — shared visual-audit library.
 *
 * Engines:
 *   - captureScreenshots({ ... }) — capture authenticated screenshots at multiple viewports
 *   - inspectLayout({ ... }) — print a DOM layout report (overflow, grids, per-selector deep dive)
 *   - compareScreenshots({ ... }) — pixelmatch wrapper for regression diff checks
 *
 * Consumers provide an auth adapter and page registry. See docs/ADAPTER.md for the contract.
 */

export { captureScreenshots } from './capture.mjs';
export { inspectLayout } from './inspect.mjs';
export { compareScreenshots } from './compare.mjs';
export { detectOverflow } from './utils/overflow.mjs';
export { describeElement } from './utils/describe.mjs';
export { readPngDimensions } from './utils/png-dimensions.mjs';
