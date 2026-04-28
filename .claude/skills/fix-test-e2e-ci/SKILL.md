---
name: fix-test-e2e-ci
description: 'Debug failures from test-e2e.yml locally. Includes both CI-parity reproduction (app-build + test:build) and faster dev-runtime triage for Smoke Playwright tests.'
argument-hint: 'Provide the failing test-e2e.yml logs, a link to the failing workflow run, and the failing test title or file if available'
---

# Fix test-e2e.yml CI Failures

## When to Use

- `.github/workflows/test-e2e.yml` or the `e2e App Tests` workflow failed in CI.
- You want CI-parity reproduction with the same build-mode test command used in CI.
- You want a faster dev-runtime loop after confirming the same failure locally.

## Procedure

1. Start from the failing CI evidence.
   - Use the workflow run logs/artifacts to capture the failing test title, file, and first actionable error.
   - Download CI traces from the smoke-test artifact when available.
2. Reproduce with CI-parity commands first (same mode as CI):
   ```bash
   npm run app-build
   ```
   ```bash
   npm run test:build -w packages/insomnia-smoke-test -- --project=Smoke
   ```
3. Re-run only the failing test while iterating (instead of the full suite):
   - By file:

   ```bash
   npm run test:build -w packages/insomnia-smoke-test -- --project=Smoke tests/smoke/<failing-file>.test.ts
   ```

   - By test title:

   ```bash
   npm run test:build -w packages/insomnia-smoke-test -- --project=Smoke --grep "<failing test title>"
   ```

4. If CI-parity passes but you still need a faster loop for investigation, switch to dev runtime:
    ```bash
    npm run watch:app
    ```
    ```bash
    npm run test:dev -w packages/insomnia-smoke-test -- --project=Smoke
    ```
    `watch:app` is a long-running dev server. Start it in a separate terminal or detached background session, wait for it to be ready, then run `test:dev` as a second command. Do not chain `watch:app && npm run test:dev ...` because the server does not exit on success.

## Notes

- CI currently runs `npm run app-build` + `npm run test:build -w packages/insomnia-smoke-test -- --project=Smoke`.
- Dev runtime (`watch:app` + `test:dev`) is useful for quick local triage, but not a strict CI match.
- When using tool-driven terminals, treat `watch:app` as a persistent server process: launch it separately, keep it alive during repro, and stop it during teardown.
- Playwright debugging options:
  - Inspector: `PWDEBUG=1 npm run test:smoke:dev`
  - API logs: `DEBUG=pw:api npm run test:smoke:dev`
  - Browser console logs: `DEBUG=pw:browser npm run test:smoke:dev`
  - WebServer logs: `DEBUG=pw:WebServer npm run test:smoke:dev`
- Local traces are written under `packages/insomnia-smoke-test/traces` and can be opened with:
  ```bash
  npx playwright show-trace packages/insomnia-smoke-test/traces/<trace-folder>/trace.zip
  ```
- Success criteria:
  - The failing Smoke test passes with the CI-parity command (`test:build`).
  - The full Smoke project passes in build mode after your fix.

## Teardown

- Stop any long-running watch/test terminals (for example `watch:app`) after validation is complete.
- Playwright itself should teardown the smoke test server, but if you have any lingering processes or ports in use, stop those as well.
