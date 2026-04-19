# Adapter contract

`@sptk-epb/visual-audit` is runtime-agnostic. Each consuming project provides an
**auth adapter** and a **page registry** that describe how to sign in and which
pages to capture.

## Auth adapter

```js
/**
 * @param {import('playwright').Browser} browser
 * @param {string} baseUrl
 * @returns {Promise<object>} Playwright storageState
 */
async function authenticate(browser, baseUrl) {
  // 1. Pick credentials (env var, secrets file, hard-coded local test user, ...)
  // 2. Hit your app's sign-in API (or UI).
  // 3. Return a Playwright storageState with the session cookie set.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const res = await context.request.post(`${baseUrl}/api/auth/sign-in/email`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Sign-in failed (${res.status()})`);
  const storageState = await context.storageState();
  await context.close();
  return storageState;
}
```

### Contract

- Must return a value compatible with `browser.newContext({ storageState })`.
- Must throw on failure — the library treats a thrown error as fatal.
- Must not leave `browser.contexts()` open (library owns teardown).
- Must never log secrets (the library does NOT redact its logs).

### Local vs staging

Projects typically branch on the `baseUrl` host:

- **Local**: create-or-ensure a test user via the project's sign-up API; read
  password from `LOCAL_EMAIL`/`LOCAL_PASSWORD` env or use a hard-coded default.
- **Staging/prod**: read `STAGING_EMAIL`/`STAGING_PASSWORD` from env or from
  `~/secrets.env`. Fail fast if missing.

## Page registry

```ts
type PageConfig = {
  path: string;                // Must start with '/'
  auth?: boolean;              // Default true. Set false for public pages.
  setup?: (
    page: Page,
    ctx: { name: string; width: number; baseUrl: string }
  ) => Promise<void>;
};

type Pages = Record<string, PageConfig>;
```

The key is used in the screenshot filename (`<key>-<width>.png`). Keep keys
kebab-case — they should sort well in a directory listing.

### Setup hooks

Two places you can run pre-capture interactions:

1. **Per-page `setup`**: fires after navigation, before capture. Use for
   state-dependent UI (click a template, open a modal, select a row).
2. **Global `setup` option**: fallback when a page has no per-page setup.
   Per-page setup wins.

```js
export const PAGES = {
  // Public page, skip auth
  signin: { path: '/signin', auth: false },

  // Simple authenticated page
  dashboard: { path: '/dashboard' },

  // Page that needs state before capture
  'policy-builder': {
    path: '/dashboard/policies',
    setup: async (page, { width }) => {
      // Click a template so the builder isn't empty
      await page.click('[data-testid=template-standard]');
      await page.waitForSelector('[data-testid=policy-editor]');
    },
  },
};
```

## Filename convention

Captures land at `<outDir>/<page-key>-<width>.png`. If `archive: true` and a
capture already exists, the library renames the existing file to
`<page-key>-<width>-before.png` BEFORE writing the new one — first-before wins,
so re-running preserves the original baseline.

## Example: UDM adapter

See `android-device-manager/scripts/lib/playwright-auth.mjs` for a production
adapter that:

- Creates a local test user via `/api/auth/sign-up/email`
- Marks the user `email_verified = 1` via `npx wrangler d1 execute --local`
- Reads staging creds from `STAGING_EMAIL`/`STAGING_PASSWORD` or `~/secrets.env`
- Exports a `PAGES` registry with 19 dashboard routes
