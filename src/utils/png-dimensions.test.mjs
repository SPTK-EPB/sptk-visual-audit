/**
 * Unit tests for readPngDimensions.
 *
 * Writes real PNG files via pngjs (a devDep this repo already has via the
 * compareScreenshots peer-dep surface) and asserts the parser extracts
 * correct width/height without loading full image data.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { readPngDimensions } from './png-dimensions.mjs';

async function withTmpDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pngdims-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function makePng(width, height) {
  return PNG.sync.write(new PNG({ width, height }));
}

test('readPngDimensions: reads 10x10 PNG', async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, 'small.png');
    await writeFile(path, makePng(10, 10));
    const dims = await readPngDimensions(path);
    assert.deepEqual(dims, { width: 10, height: 10 });
  });
});

test('readPngDimensions: reads asymmetric 1280x720 PNG', async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, 'wide.png');
    await writeFile(path, makePng(1280, 720));
    const dims = await readPngDimensions(path);
    assert.deepEqual(dims, { width: 1280, height: 720 });
  });
});

test('readPngDimensions: reads tall full-page capture (360x4000)', async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, 'tall.png');
    await writeFile(path, makePng(360, 4000));
    const dims = await readPngDimensions(path);
    assert.deepEqual(dims, { width: 360, height: 4000 });
  });
});

test('readPngDimensions: throws on non-PNG', async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, 'notpng.png');
    await writeFile(path, Buffer.alloc(24, 0));
    await assert.rejects(() => readPngDimensions(path), /not a PNG/);
  });
});

test('readPngDimensions: throws on truncated file', async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, 'short.png');
    await writeFile(path, Buffer.alloc(10, 0));
    await assert.rejects(() => readPngDimensions(path), /too short/);
  });
});

test('readPngDimensions: throws on missing file', async () => {
  await assert.rejects(() => readPngDimensions('/tmp/nonexistent-' + Date.now() + '.png'));
});
