/**
 * Return a compact CSS-selector-ish description of a DOM element.
 * Used by inspect-layout to keep reports greppable.
 *
 * This is intended to be called INSIDE `page.evaluate()` — it must not rely on
 * anything outside the browser context.
 *
 * @param {Element} el
 * @returns {string}
 */
export function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : '';
  const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
  return `<${tag}${id}${cls}${role}>`;
}
