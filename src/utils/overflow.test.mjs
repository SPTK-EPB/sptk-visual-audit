/**
 * Unit tests for detectOverflow.
 *
 * Uses a minimal Playwright-Page stub (just page.evaluate returning the dims
 * the helper extracts). Avoids spinning up a real browser — the helper's
 * logic is the boolean comparison, not the DOM read.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOverflow } from './overflow.mjs';

function stubPage(dims) {
  return {
    async evaluate(_fn) {
      return dims;
    },
  };
}

test('detectOverflow: no overflow when scrollWidth === innerWidth', async () => {
  const page = stubPage({ scrollWidth: 360, innerWidth: 360 });
  const result = await detectOverflow(page);
  assert.deepEqual(result, { scrollWidth: 360, innerWidth: 360, overflow: false });
});

test('detectOverflow: no overflow when scrollWidth < innerWidth', async () => {
  const page = stubPage({ scrollWidth: 300, innerWidth: 360 });
  const result = await detectOverflow(page);
  assert.equal(result.overflow, false);
});

test('detectOverflow: overflow when scrollWidth > innerWidth', async () => {
  const page = stubPage({ scrollWidth: 400, innerWidth: 360 });
  const result = await detectOverflow(page);
  assert.deepEqual(result, { scrollWidth: 400, innerWidth: 360, overflow: true });
});

test('detectOverflow: large overflow', async () => {
  const page = stubPage({ scrollWidth: 1280, innerWidth: 360 });
  const result = await detectOverflow(page);
  assert.equal(result.overflow, true);
});
