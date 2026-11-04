# Testing

| Layer | Tool | Location |
|---|---|---|
| Unit | Vitest | Next to the code, as `*.test.ts` |
| Plugin | Node test runner | `packages/restless-plugin-secret-managers` |
| End-to-end | Playwright | `packages/insomnia-smoke-test` |

## Unit tests

```bash
npm test
```

## Smoke tests

Build first, then run them headless:

```bash
npm run app-build
```

```bash
HEADLESS=1 npm run test:smoke:build
```

A full run takes over 20 minutes, longer on a slow machine. Playwright stops at its global timeout, so tests that didn't run are not failures. Pass `--global-timeout` to allow more time.

## CLI tests

```bash
npm run build -w packages/insomnia-inso
```

The `inso packaged binary` group needs a packaged binary, and is not part of `npm test`.

## Testing the title bar

Headless mode has no window controls. Check them in a real window on Linux, and when you change themes.

Playwright forces a light color scheme. Pass `colorScheme: 'no-override'` when testing system themes.

## Before merging

- `npm run lint`
- `npm run type-check`
- `npm test`
- Smoke tests
