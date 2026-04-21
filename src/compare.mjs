/**
 * compareScreenshots — pixelmatch wrapper for regression diff checks.
 *
 * Wraps `pixelmatch` + `pngjs` so consumers can answer "is this PNG diff real?"
 * without re-inventing the boilerplate. Pairs naturally with
 * `captureScreenshots` — capture before + after, compare, decide.
 *
 * `pixelmatch` and `pngjs` are peer dependencies — consumers install them if
 * they use this module.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * @typedef {Object} CompareOptions
 * @property {string} baselinePath             Path to the baseline PNG.
 * @property {string} currentPath              Path to the current PNG.
 * @property {number} [tolerance]              pixelmatch `threshold` option
 *                                              (0..1). Default 0.1. Higher =
 *                                              more tolerant. 0.1 absorbs
 *                                              PNG compression variance,
 *                                              ≥0.5 would hide real drift.
 * @property {string} [diffOutputPath]         Optional path to write a
 *                                              red-channel diff PNG. Parent
 *                                              dir is created if missing.
 * @property {boolean} [includeAA]             Default true. Pass through to
 *                                              pixelmatch. Set false to
 *                                              suppress antialias noise.
 */

/**
 * @typedef {Object} CompareResult
 * @property {boolean} match                   true iff diffPixels === 0.
 * @property {number} diffPixels               Count of differing pixels.
 * @property {number} diffPercent              diffPixels / (width*height),
 *                                              rounded to 4 decimals.
 * @property {number} width
 * @property {number} height
 * @property {string} [diffImagePath]          Present iff diffOutputPath was
 *                                              provided and written.
 */

async function loadPixelmatch() {
  try {
    const mod = await import('pixelmatch');
    return mod.default;
  } catch (err) {
    throw new Error(
      `compareScreenshots requires 'pixelmatch' as a peer dependency. ` +
        `Install it with: npm install pixelmatch pngjs\n` +
        `Underlying error: ${err.message}`
    );
  }
}

async function loadPngjs() {
  try {
    const mod = await import('pngjs');
    return mod.PNG;
  } catch (err) {
    throw new Error(
      `compareScreenshots requires 'pngjs' as a peer dependency. ` +
        `Install it with: npm install pixelmatch pngjs\n` +
        `Underlying error: ${err.message}`
    );
  }
}

/**
 * Compare two PNGs. Throws if dimensions differ or files are unreadable.
 *
 * @param {CompareOptions} opts
 * @returns {Promise<CompareResult>}
 */
export async function compareScreenshots(opts) {
  const {
    baselinePath,
    currentPath,
    tolerance = 0.1,
    diffOutputPath,
    includeAA = true,
  } = opts;

  if (typeof baselinePath !== 'string' || typeof currentPath !== 'string') {
    throw new Error('compareScreenshots: baselinePath and currentPath are required');
  }
  if (typeof tolerance !== 'number' || tolerance < 0 || tolerance > 1) {
    throw new Error(`compareScreenshots: tolerance must be a number in [0, 1], got ${tolerance}`);
  }

  const [pixelmatch, PNG] = await Promise.all([loadPixelmatch(), loadPngjs()]);

  const [baselineBuf, currentBuf] = await Promise.all([
    readFile(baselinePath),
    readFile(currentPath),
  ]);

  const baseline = PNG.sync.read(baselineBuf);
  const current = PNG.sync.read(currentBuf);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `compareScreenshots: dimension mismatch — baseline=${baseline.width}x${baseline.height}, ` +
        `current=${current.width}x${current.height}`
    );
  }

  const { width, height } = baseline;
  const diff = diffOutputPath ? new PNG({ width, height }) : null;
  const diffData = diff ? diff.data : null;

  const diffPixels = pixelmatch(baseline.data, current.data, diffData, width, height, {
    threshold: tolerance,
    includeAA,
  });

  const diffPercent = Math.round((diffPixels / (width * height)) * 10000) / 10000;

  /** @type {CompareResult} */
  const result = {
    match: diffPixels === 0,
    diffPixels,
    diffPercent,
    width,
    height,
  };

  if (diff && diffOutputPath) {
    await mkdir(dirname(diffOutputPath), { recursive: true });
    await writeFile(diffOutputPath, PNG.sync.write(diff));
    result.diffImagePath = diffOutputPath;
  }

  return result;
}
