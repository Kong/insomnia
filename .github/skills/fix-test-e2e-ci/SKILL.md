---
name: fix-test-e2e-ci
description: 'Debug failures in test-e2e.yaml locally without a build step. Use when GitHub Actions e2e smoke tests fail, vite dev runtime issues appear, or Smoke project Playwright checks are flaky.'
argument-hint: 'Describe the failing job, failing test, and any error output from test-e2e.yaml'
---

# Fix test-e2e.yaml CI Failures

## When to Use
- `test-e2e.yaml` failed in CI.
- You need to reproduce smoke test failures quickly without waiting for a bundle build.
- You want to run the `Smoke` Playwright project against a local dev app.

## Procedure
1. Start the app in dev-watch mode:
   ```bash
   npm run watch:app
   ```
2. In a separate terminal, run the smoke tests against the dev runtime:
   ```bash
   npm run test:dev -w packages/insomnia-smoke-test -- --project=Smoke
   ```
3. Keep `watch:app` running while you iterate on fixes.
4. Re-run the same `test:dev` command after each change to confirm the failure is resolved.

## Notes
- This path skips the bundle/build step, so it is faster for first-pass debugging.
- If the issue only reproduces in bundle mode, switch to the CLI bundle debug workflow skill.
