#!/usr/bin/env bash
# Library maintainer setup. Run once after clone, or to refresh after a deps change.
#
# Installs dev deps (Playwright as peer dep lives in devDependencies for the
# library itself) and the Chromium browser binary Playwright needs at runtime.
#
# Uses `npm` for consistency with CI and the committed `package-lock.json`.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ npm install"
npm install

# Playwright ships Chromium separately — peer dep install does NOT fetch the
# browser binary, and capture.mjs fails at runtime without it.
if command -v bunx >/dev/null 2>&1; then
  echo "→ bunx playwright install chromium"
  bunx playwright install chromium
else
  echo "→ npx playwright install chromium"
  npx playwright install chromium
fi

echo
echo "Done. Try:"
echo "  bun test            # run tests (node --test on src/**/*.test.mjs)"
echo "  node --check src/**/*.mjs   # syntax check (same gate CI uses)"
echo "  npm link            # then in a consumer: npm link @sptk-epb/visual-audit"
