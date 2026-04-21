/**
 * Unit tests for compareScreenshots.
 *
 * Generates fixture PNGs at test time via pngjs (already a devDep). Covers
 * identical, divergent, diff-PNG output, dimension mismatch, and input
 * validation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { compareScreenshots } from './compare.mjs';

async function withTmpDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'compare-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function solidPng(width, height, r, g, b, a = 255) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height * 4; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return PNG.sync.write(png);
}

test('compareScreenshots: identical PNGs → match, zero diff', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    await writeFile(a, solidPng(10, 10, 255, 0, 0));
    await writeFile(b, solidPng(10, 10, 255, 0, 0));
    const result = await compareScreenshots({ baselinePath: a, currentPath: b });
    assert.equal(result.match, true);
    assert.equal(result.diffPixels, 0);
    assert.equal(result.diffPercent, 0);
    assert.equal(result.width, 10);
    assert.equal(result.height, 10);
    assert.equal(result.diffImagePath, undefined);
  });
});

test('compareScreenshots: fully divergent PNGs → every pixel differs', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'red.png');
    const b = join(dir, 'blue.png');
    await writeFile(a, solidPng(10, 10, 255, 0, 0));
    await writeFile(b, solidPng(10, 10, 0, 0, 255));
    const result = await compareScreenshots({ baselinePath: a, currentPath: b });
    assert.equal(result.match, false);
    assert.equal(result.diffPixels, 100);
    assert.equal(result.diffPercent, 1);
  });
});

test('compareScreenshots: writes diff PNG when diffOutputPath set', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    const diffPath = join(dir, 'nested', 'diff.png');
    await writeFile(a, solidPng(10, 10, 255, 0, 0));
    await writeFile(b, solidPng(10, 10, 0, 0, 255));
    const result = await compareScreenshots({
      baselinePath: a,
      currentPath: b,
      diffOutputPath: diffPath,
    });
    assert.equal(result.diffImagePath, diffPath);
    const s = await stat(diffPath);
    assert.ok(s.size > 0, 'diff PNG should be non-empty');
  });
});

test('compareScreenshots: dimension mismatch throws', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    await writeFile(a, solidPng(10, 10, 255, 0, 0));
    await writeFile(b, solidPng(10, 20, 255, 0, 0));
    await assert.rejects(
      () => compareScreenshots({ baselinePath: a, currentPath: b }),
      /dimension mismatch/
    );
  });
});

test('compareScreenshots: tolerance out of range throws', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    await writeFile(a, solidPng(10, 10, 255, 0, 0));
    await writeFile(b, solidPng(10, 10, 255, 0, 0));
    await assert.rejects(
      () => compareScreenshots({ baselinePath: a, currentPath: b, tolerance: 2 }),
      /tolerance must be a number in \[0, 1\]/
    );
  });
});

test('compareScreenshots: missing required args throws', async () => {
  await assert.rejects(
    () => compareScreenshots({ baselinePath: 'a', currentPath: 123 }),
    /baselinePath and currentPath are required/
  );
});

test('compareScreenshots: tolerance=0 treats any drift as non-match', async () => {
  await withTmpDir(async (dir) => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    // Two almost-identical pixels; at tolerance=0 even a small diff shows.
    const pngA = new PNG({ width: 1, height: 1 });
    pngA.data[0] = 100; pngA.data[1] = 100; pngA.data[2] = 100; pngA.data[3] = 255;
    const pngB = new PNG({ width: 1, height: 1 });
    pngB.data[0] = 110; pngB.data[1] = 100; pngB.data[2] = 100; pngB.data[3] = 255;
    await writeFile(a, PNG.sync.write(pngA));
    await writeFile(b, PNG.sync.write(pngB));
    const result = await compareScreenshots({ baselinePath: a, currentPath: b, tolerance: 0 });
    assert.equal(result.match, false);
  });
});
