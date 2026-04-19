/**
 * Check if a page's document overflows its viewport horizontally.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ scrollWidth: number, innerWidth: number, overflow: boolean }>}
 */
export async function detectOverflow(page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  return { ...dims, overflow: dims.scrollWidth > dims.innerWidth };
}
