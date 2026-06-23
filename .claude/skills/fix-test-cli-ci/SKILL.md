---
name: fix-test-cli-ci
description: 'Debug failures from the test-cli.yml workflow locally. Use when insomnia-inso bundle tests fail in CI, especially node-vs-electron dependency/runtime mismatches.'
argument-hint: 'Provide the failing test-cli.yml logs, a link to the failing workflow run, or the failing test name from npm run test:bundle -w insomnia-inso'
---

# Fix test-cli.yml CI Failures

## When to Use

- `.github/workflows/test-cli.yml` or the `Test CLI` workflow failed in CI.
- `inso` bundle tests fail locally or in GitHub Actions.
- You suspect node module/runtime differences between Node.js and Electron.

## Procedure

1. Start with the failing CI evidence.
   - Use the provided logs or workflow run link to identify whether the failure happened during the `test:bundle` run, the packaged binary run, or the build/package setup before the tests.
   - Note the failing test name and the first actionable error message before reproducing locally.
2. Ensure Node.js native dependencies are installed (not Electron-targeted variants):
   ```bash
   npm run install-libcurl-node
   ```
3. Build `insomnia-inso` to generate `dist`:
   ```bash
   npm run build -w insomnia-inso
   ```
4. Start the smoke-test echo server used by the CLI tests:
   ```bash
   npm run serve -w insomnia-smoke-test
   ```
5. In another terminal, run the bundled CLI test suite:
   ```bash
   npm run test:bundle -w insomnia-inso
   ```
6. If the CI failure was in the packaged binary path or the bundle suite passes locally, run:
   ```bash
   npm run test:binary -w insomnia-inso
   ```

## Notes

- Keep the smoke-test server running while bundle tests execute.
- Common failure patterns:
  - Errors involving `@getinsomnia/node-libcurl`, `NODE_MODULE_VERSION`, `dlopen`, or native module loading usually mean the Node-targeted libcurl binary needs to be reinstalled with `npm run install-libcurl-node`.
  - Connection failures to `http://localhost:4010` usually mean the smoke-test server is not running.
  - Missing `dist` output or missing `binaries/inso` usually means `npm run build -w insomnia-inso` or the package step needs to be rerun.
- Success criteria:
  - `npm run test:bundle -w insomnia-inso` exits successfully and Vitest reports the `inso dev bundle` tests as passing.
  - If validating the packaged binary path, `npm run test:binary -w insomnia-inso` also exits successfully.

## Teardown

- Stop the `npm run serve -w insomnia-smoke-test` process once validation is complete.
- Reinstall the electron-targeted libcurl binary for continued Electron development:
  ```bash
  npm run install-libcurl-electron
  ```
