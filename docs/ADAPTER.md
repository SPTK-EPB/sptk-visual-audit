# Adapter contract

`@sptk-epb/visual-audit` is runtime-agnostic. Each consuming project provides an
**auth adapter** and a **page registry** that describe how to sign in and which
pages to capture.

## Auth adapter

Two patterns are supported, depending on how the consumer's app holds session
state:

- **Pattern A — browser-held cookie**: the adapter signs in via the app's API,
  captures the cookie into Playwright's `storageState`, and the browser
  replays it on every request. Use when the backend issues cookies directly
  to the browser (most apps).
- **Pattern B — server-side proxy auth**: the dev server itself holds the
  session (via env var), attaches it to outgoing fetches to the backend, and
  the browser never sees a cookie. The adapter probes readiness and returns
  an empty `storageState`.

### Contract (both patterns)

- Must return a value compatible with `browser.newContext({ storageState })`.
  An empty `{ cookies: [], origins: [] }` is valid.
- Must throw on failure — the library treats a thrown error as fatal.
- Must not leave `browser.contexts()` open (library owns teardown).
- Must never log secrets (the library does NOT redact its logs).

### Pattern A — browser-held cookie

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

### Pattern B — server-side proxy auth

Some dev servers (e.g. Astro on Cloudflare Workers) hold the session cookie
themselves — typically loaded from `DEV_SESSION_COOKIE` in `.env.local` — and
attach it server-side on outgoing fetches to the backend API. The browser
never holds a cookie; there is nothing for the library to inject into
`storageState`. The adapter's job is to confirm the dev server is actually
authenticated (so the capture doesn't silently hit a sign-in redirect) and
return an empty state.

```js
/**
 * @param {import('playwright').Browser} _browser  Unused — no cookie to capture.
 * @param {string} baseUrl
 * @returns {Promise<object>} Empty Playwright storageState
 */
async function authenticate(_browser, baseUrl) {
  // Probe a known-authenticated page via the dev server. If the dev server's
  // session cookie isn't loaded, the response redirects to /signin (or returns
  // a public shell) and the probe throws.
  const res = await fetch(`${baseUrl}/my/devices`, { redirect: 'manual' });
  if (res.status === 302 || res.status === 303) {
    throw new Error(
      `Dev server not authenticated: ${baseUrl}/my/devices redirected to ${res.headers.get('location')}. ` +
        `Set DEV_SESSION_COOKIE in .env.local and restart the dev server.`
    );
  }
  if (!res.ok) throw new Error(`Probe failed (${res.status})`);
  return { cookies: [], origins: [] };
}
```

Canonical reference: [dugnad-dashboard/audit/auth.mjs](https://github.com/SPTK-EPB/dugnad-dashboard/blob/main/audit/auth.mjs).

Gotcha: `bun run <script>` populates `.env.local` vars in Bun's own
`process.env`, but child `node`-shim binaries (`astro`, `vite`, `next`)
re-exec via their shebang and lose those vars. Wrap the dev script with
`bash -c 'set -a; [ -f .env.local ] && . ./.env.local; set +a; exec <cmd>'`
so the server process actually sees `DEV_SESSION_COOKIE`.

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
