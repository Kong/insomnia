---
name: quick-check
description: "Run the smallest useful format, lint, type-check, or test command for the affected Insomnia workspace, and only escalate to broader validation when the change scope justifies it."
argument-hint: "Provide changed file paths and the desired check type (format, lint, type-check, test), or name the target workspace and what you want validated"
---

# Quick Workspace Checks

## When to Use

- You are iterating on a change and want the fastest useful validation loop.
- The change is limited to one workspace or a small set of files.
- You do not want repo-wide checks yet.

## Core Rule

Choose the smallest affected workspace first. Only expand to more workspaces or repo-wide checks when the change crosses boundaries.

## Workspace Mapping

| Changed paths                                | Workspace                        | Quick checks                                                                                                                                           |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/insomnia/**`                       | `insomnia`                       | `npm run lint -w insomnia`, `npm run type-check -w insomnia`, `npm test -w insomnia`                                                                   |
| `packages/insomnia-api/**`                   | `insomnia-api`                   | `npm run lint -w insomnia-api`, `npm run type-check -w insomnia-api`                                                                                   |
| `packages/insomnia-inso/**`                  | `insomnia-inso`                  | `npm run lint -w insomnia-inso`, `npm run type-check -w insomnia-inso`, `npm run test:unit -w insomnia-inso`                                           |
| `packages/insomnia-testing/**`               | `insomnia-testing`               | `npm run lint -w insomnia-testing`, `npm run type-check -w insomnia-testing`, `npm test -w insomnia-testing`                                           |
| `packages/insomnia-scripting-environment/**` | `insomnia-scripting-environment` | `npm run lint -w insomnia-scripting-environment`, `npm run type-check -w insomnia-scripting-environment`, `npm test -w insomnia-scripting-environment` |
| `packages/insomnia-smoke-test/**`            | `insomnia-smoke-test`            | `npm run lint -w insomnia-smoke-test`, `npm run test:dev -w insomnia-smoke-test -- --project=Smoke <optional file>`                                    |

## Check Types

- `format`
  ```bash
  npx prettier --write <changed files>
  ```
- `lint`
  Run prettier, then eslint --fix, then verify:
  ```bash
  npx prettier --write <changed files>
  npx eslint --fix <changed files>
  npm run lint -w <workspace>
  ```
- `type-check`
  ```bash
  npm run type-check -w <workspace>
  ```
- `test`
  Use the workspace test command or the narrowest file-specific test you can.

## Targeted Test Shortcuts

- App:
  ```bash
  npm test -w insomnia -- --run src/<path>/<file>.test.ts
  ```
- Testing:
  ```bash
  npm test -w insomnia-testing -- --run src/<path>/<file>.test.ts
  ```
- Scripting environment:
  ```bash
  npm test -w insomnia-scripting-environment -- --run src/<path>/<file>.test.ts
  ```
- CLI:
  ```bash
  npm run test:unit -w insomnia-inso
  ```
- Smoke:
  ```bash
  npm run test:dev -w insomnia-smoke-test -- --project=Smoke tests/smoke/<file>.test.ts
  ```

## App E2E Near Push

Prefer the fastest path first.

### Fast dev-runtime path

Run these in separate terminals:

- Terminal 1:
  ```bash
  npm run dev
  ```
  or
  ```bash
  npm run watch:app
  ```
- Terminal 2:
  ```bash
  npm run test:dev -w insomnia-smoke-test -- --project=Smoke tests/smoke/<file>.test.ts
  ```

### Built-app path

Use this when Vite config changed, when you need build-mode confidence, or when the failure only reproduces in the built app.

Run these as separate steps, preferably in separate terminals:

- Terminal 1:
  ```bash
  npm run app-build
  ```
- Terminal 2:
  ```bash
  npm run test:build -w insomnia-smoke-test -- --project=Smoke tests/smoke/<file>.test.ts
  ```

## Escalate Scope When

- You changed more than one workspace.
- You changed root config or shared tooling such as `package.json`, `package-lock.json`, or `eslint.config.mjs`.
- You changed shared code paths used by multiple workspaces.
- You touched the renderer/main boundary. In that case consider:
  ```bash
  npm run check:renderer-node-imports -w insomnia
  ```

If the scope is broad enough, use the repo-wide commands:

```bash
npm run lint
npm run type-check
npm test
```

## Notes

- In VS Code, format-on-save runs Prettier (`esbenp.prettier-vscode`) then ESLint autofix (`source.fixAll.eslint`) in that order. The lint check type above replicates this.
- `insomnia-smoke-test` has no `type-check` script.
- `insomnia-inso` has no generic `test` script; prefer `test:unit` for quick checks.
