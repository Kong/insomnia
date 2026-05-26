---
name: quick-check
description: "Run the smallest useful format, lint, type-check, or test command for the affected Insomnia workspace, and only escalate to broader validation when the change scope justifies it."
argument-hint: "Provide changed file paths and the desired check type (format, lint, type-check, test), or name the target workspace and what you want validated"
---

## Workspace Mapping

| Changed paths                                | Workspace                        | Commands                                                                                                 |
| -------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/insomnia/**`                       | `insomnia`                       | `npm run lint -w insomnia`, `npm run type-check -w insomnia`, `npm test -w insomnia`                     |
| `packages/insomnia-api/**`                   | `insomnia-api`                   | `npm run lint -w insomnia-api`, `npm run type-check -w insomnia-api`                                     |
| `packages/insomnia-inso/**`                  | `insomnia-inso`                  | `npm run lint -w insomnia-inso`, `npm run type-check -w insomnia-inso`, `npm run test:unit -w insomnia-inso` |
| `packages/insomnia-testing/**`               | `insomnia-testing`               | `npm run lint -w insomnia-testing`, `npm run type-check -w insomnia-testing`, `npm test -w insomnia-testing` |
| `packages/insomnia-scripting-environment/**` | `insomnia-scripting-environment` | `npm run lint -w insomnia-scripting-environment`, `npm run type-check -w insomnia-scripting-environment`, `npm test -w insomnia-scripting-environment` |
| `packages/insomnia-smoke-test/**`            | `insomnia-smoke-test`            | `npm run lint -w insomnia-smoke-test`, `npm run test:dev -w insomnia-smoke-test -- --project=Smoke <file>` |

`insomnia-smoke-test` has no `type-check` script. `insomnia-inso` has no generic `test` script.

## Lint

Format then fix then verify:

```bash
npx prettier --write <changed files>
npx eslint --fix <changed files>
npm run lint -w <workspace>
```

## Targeted Tests

Narrow to a single file using `--run`:

```bash
npm test -w <workspace> -- --run src/<path>/<file>.test.ts
```

For smoke tests:

```bash
npm run test:dev -w insomnia-smoke-test -- --project=Smoke tests/smoke/<file>.test.ts
```

To run smoke tests against the dev server, start `npm run dev` in a separate terminal first. Use `npm run app-build` + `npm run test:build` only when the failure requires a production build.

## Escalate When

- Change spans more than one workspace
- Root config changed (`package.json`, `package-lock.json`, `eslint.config.mjs`)
- Renderer/main boundary touched — also run `npm run check:renderer-node-imports -w insomnia`

```bash
npm run lint && npm run type-check && npm test
```
