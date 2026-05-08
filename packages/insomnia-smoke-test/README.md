# Insomnia Smoke Tests

Playwright E2E tests for the Insomnia desktop app.

> CLI smoke tests: [CLI.md](CLI.md)

## Test structure

```
tests/
  smoke/      # Main suite — runs on every CI push (Ubuntu only)
  critical/   # Single critical-path test — runs on release
  migration/  # Data migration tests
```

All commands below must be run from the **repo root**.

## Quick-start

```bash
npm install
npm run test:smoke:dev   # run all Smoke tests (dev mode)
```

Both the echo server (port 4010) and the Vite dev server start automatically.

**Filter to one test** — pass a substring of the test title or file name:

```bash
npm run test:smoke:dev -- oauth
```

**Interactive UI:**

```bash
npm run test:smoke:dev -- --ui
```

**Step-through debugger:**

```bash
PWDEBUG=1 npm run test:smoke:dev
```

## Additional log levels

```bash
DEBUG=pw:api npm run test:smoke:dev         # Playwright API logs
DEBUG=pw:browser npm run test:smoke:dev     # Insomnia console logs
DEBUG=pw:WebServer npm run test:smoke:dev   # Web server logs
```

## Traces and error context

On failure, two artifacts are written under `packages/insomnia-smoke-test/traces/<test-name>/`:

- **`error-context.md`** — error details, ARIA page snapshot at point of failure, and annotated test source. Read this first.
- **`trace.zip`** — full Playwright trace (network, screenshots, DOM snapshots).

Open a trace:

```bash
npx playwright show-trace packages/insomnia-smoke-test/traces/<test-name>/trace.zip
```

Or upload to [trace.playwright.dev](https://trace.playwright.dev/).

CI traces are available as artifacts on failed workflow runs.

## Build / package modes

Run against a JS bundle (`build`) or a packaged binary (`package`) instead of the dev watcher:

```bash
# build mode
npm run app-build
npm run test:smoke:build

# package mode
npm run app-package
npm run test:smoke:package
```

> macOS package mode: set `com.apple.security.cs.disable-library-validation` to `true` in `entitlements.mac.inherit.plist` to allow unsigned local binaries. Do not commit this change.

## Non-CI / pre-release tests

```bash
npm run test:dev -w insomnia-smoke-test -- tests/smoke/preferences-interactions.test.ts
```

## Cert refresh

If the custom CA cert test fails after 2026:

```bash
mkcert -install && mkcert localhost && mkcert -CAROOT
```
