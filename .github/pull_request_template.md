## Summary



## Changes

<!-- list of what moved -->

## Adapter contract impact

- [ ] No changes to `authenticate(browser, baseUrl)` signature
- [ ] No changes to `PageConfig` shape (`{ path, auth?, setup? }`)
- [ ] No new required options on `captureScreenshots` / `inspectLayout`

If any of the above are **ticked unchecked**, this is a breaking change — bump
the version and note it in the README.

## Test plan

- [ ] `node --check src/**/*.mjs` passes
- [ ] CI green
- [ ] Verified against a consumer project (which one, which page, what result)
