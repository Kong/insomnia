---
name: fix-test-cli-ci
description: 'Debug failures in test-cli-yaml locally. Use when insomnia-inso bundle tests fail in CI, especially node-vs-electron dependency/runtime mismatches.'
argument-hint: 'Provide failing test-cli-yaml logs or the failing test name from npm run test:bundle -w insomnia-inso'
---

# Fix test-cli-yaml CI Failures

## When to Use

- `test-cli-yaml` failed in CI.
- `inso` bundle tests fail locally or in GitHub Actions.
- You suspect node module/runtime differences between Node.js and Electron.

## Procedure

1. Ensure Node.js native dependencies are installed (not Electron-targeted variants):
   ```bash
   npm run install-libcurl-node
   ```
2. Build `insomnia-inso` to generate `dist`:
   ```bash
   npm run build -w insomnia-inso
   ```
3. Start the smoke-test echo server used by the e2e tests:
   ```bash
   npm run serve -w insomnia-smoke-test
   ```
4. In another terminal, run the bundled CLI test suite:
   ```bash
   npm run test:bundle -w insomnia-inso
   ```

## Notes

- Keep the smoke-test server running while bundle tests execute.
- If failures are specific to packaged binaries, follow up with `npm run test:binary -w insomnia-inso`.
