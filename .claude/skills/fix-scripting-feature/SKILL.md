---
name: fix-scripting-feature
description: 'Debug and fix issues in Insomnia''s pre-request/after-response/test scripting feature (the pm/insomnia API surface). Use when scripts throw sandbox violations, timeouts, module import errors, or produce wrong request/response/variable mutations.'
argument-hint: 'Provide the failing script snippet, the error message, and whether it happened in the app (hidden window) or inso (CLI)'
---

# Fix Scripting Feature Issues

## When to Use

- A pre-request script, after-response script, or test script (`pm.*` / `insomnia.*` API) fails, throws, or produces incorrect results.
- Errors like `SECURITY_POLICY_VIOLATION`, `no module is found for "..."`, `Timeout: Running script took too long`, or `insomnia object is invalid or script returns earlier than expected.`
- `insomnia-scripting-environment` SDK objects (`Request`, `Response`, `Environment`, `Variables`, `Collection`, `test()`) behave unexpectedly.

## Architecture (read this first)

Pre-request/after-response/test scripts (the Postman-compatible `pm`/`insomnia` API) have **two execution paths** depending on where the script runs:

| Path | Entry point | Sandboxing |
|---|---|---|
| Electron app (default) | `packages/insomnia/src/entry.hidden-window.ts` → `packages/insomnia/src/scripting/run-script.ts`, run in a hidden `BrowserWindow` (see `packages/insomnia/src/main/window-utils.ts`) | AST-based via `packages/insomnia/src/scripting/sandbox.ts` + `script-security-rules.ts` + `require-interceptor.ts`, toggled by `context.settings.scriptSandboxEnabled` (default on) |
| `inso` CLI | `packages/insomnia/src/script-executor.ts` (plain `AsyncFunction`/`eval`, no Electron) | None — `script-executor.ts` never calls `sandbox.ts`'s `prepareSandbox`, it's a structurally separate implementation. (Don't confuse this with `canSandbox = !!process.type` in `packages/insomnia/src/runtimes/network/network-adapter.node.ts` — that gates **plugin** request/response hook sandboxing, an unrelated subsystem.) |

The SDK object model (`InsomniaObject`, `Request`, `Response`, `Environment`, `Variables`, `Collection`, `Test`, console/send-request shims) lives in `packages/insomnia-scripting-environment/src/objects/` and is shared across both paths.

## `insomnia-scripting-environment` Folder Hierarchy

The SDK package (`packages/insomnia-scripting-environment/`) is where the `pm`/`insomnia` object model lives — start here for any bug about a specific script API's behavior:

```
insomnia-scripting-environment/
├── src/
│   ├── objects/                   # the pm/insomnia API surface — one file per SDK concept
│   │   ├── index.ts               # public re-exports
│   │   ├── insomnia.ts            # InsomniaObject — the top-level `insomnia`/`pm` instance scripts see
│   │   ├── interfaces.ts          # RequestContext, IEnvironment — the context shape passed in/out of a script run
│   │   ├── execution.ts           # Execution — pm.execution (setNextRequest, skipRequest, location)
│   │   ├── request.ts             # Request, RequestBody — pm.request
│   │   ├── request-info.ts        # RequestInfo — pm.info (event name, iteration data)
│   │   ├── response.ts            # Response — pm.response
│   │   ├── send-request.ts        # pm.sendRequest() implementation
│   │   ├── environments.ts        # Environment, Variables — pm.environment / pm.globals
│   │   ├── variables.ts           # Variable, VariableList — underlying key/value model shared by environments/collection
│   │   ├── collection.ts          # Collection — pm.collectionVariables / folder & collection variable resolution
│   │   ├── folders.ts             # Folder, ParentFolders — collection folder hierarchy walked for variable resolution
│   │   ├── properties.ts          # PropertyBase, PropertyList — base classes most SDK objects extend
│   │   ├── headers.ts             # Header, HeaderList
│   │   ├── cookies.ts             # Cookie, CookieJar, CookieList — pm.cookies
│   │   ├── auth.ts                # RequestAuth — pm.request.auth
│   │   ├── certificates.ts        # Certificate — client cert modeling
│   │   ├── proxy-configs.ts       # ProxyConfig, ProxyConfigList
│   │   ├── urls.ts                # Url, QueryParam, UrlMatchPattern — URL parsing/manipulation
│   │   ├── console.ts             # Console — console.log capture surfaced back to the app
│   │   ├── test.ts                # pm.test()/test() handler registration + TestHandler, waitForAllTestsDone
│   │   ├── async-objects.ts       # ProxiedPromise — Promise plumbing so async script code can be awaited by the host
│   │   ├── interpolator.ts        # template-tag ({{ }}) interpolation used when resolving variable values
│   │   ├── utils.ts               # misc helpers (e.g. checkIfUrlIncludesTag)
│   │   └── __tests__/             # one test file per object above (request.test.ts, response.test.ts, etc.)
│   └── autocomplete-snippets.json # generated editor autocomplete data — see scripts/generate-autocomplete.ts
├── scripts/
│   └── generate-autocomplete.ts   # regenerates autocomplete-snippets.json from the objects/ source (CI-checked)
├── docs/                          # TypeDoc-generated API reference (generated from objects/, don't hand-edit)
├── typedoc.json                   # TypeDoc config for docs/ generation
└── vitest.config.ts               # test runner config for `npm test -w insomnia-scripting-environment`
```

If a bug is about *how* a script executes (sandboxing, timeouts, hidden window vs. `inso`), look in `packages/insomnia/src/scripting/` (see Architecture above). If it's about *what a specific API returns or mutates* (`pm.request.headers`, `pm.environment.get()`, `pm.response.json()`, etc.), it's almost always in this package's `src/objects/`.

For property/method-level detail on any single object above (real signatures, script-facing surface, gotchas), see `references/objects/<name>.md` in this skill folder — one file per source file in `src/objects/` (e.g. `references/objects/request.md` for `request.ts`, `references/objects/environments.md` for `environments.ts`).

## Procedure

1. **Identify the execution path first** — ask/check whether the failure is in the Electron app or `inso`. Fixes and even error messages differ per path (see table above).
2. **Reproduce with the narrowest test** before touching app code:
   - Unit tests for the sandbox/security logic:
     ```bash
     npm test -w insomnia -- src/scripting
     ```
     (not `npx vitest run src/scripting -w insomnia` — Vitest's own CLI already owns `-w`/`--watch`, so that form drops into watch mode instead of selecting the `insomnia` workspace.)
     Relevant files: `packages/insomnia/src/scripting/__tests__/sandbox.test.ts`, `__tests__/script-security-policy.test.ts`, `__tests__/require-interceptor.test.ts`.
   - SDK object-model unit tests:
     ```bash
     npm test -w insomnia-scripting-environment
     ```
   - Full app unit suite (if narrowing further isn't obvious):
     ```bash
     npm test -w insomnia
     ```
3. **If the bug only shows up end-to-end** (real app, real request lifecycle), run the Playwright smoke tests:
   ```bash
   npm run test:dev -w insomnia-smoke-test -- --grep "pre-request"
   npm run test:dev -w insomnia-smoke-test -- --grep "after-response"
   ```
   Relevant specs in `packages/insomnia-smoke-test/tests/smoke/`: `pre-request-script-features.test.ts`, `after-response-script-features.test.ts`, `pre-request-script-window.test.ts`.
4. **Locate the fix by symptom** (see Notes below for the mapping from error message to file).
5. **If you change the SDK's public API surface** (new/changed methods on `Request`/`Response`/`Environment`/etc. in `insomnia-scripting-environment`), regenerate autocomplete snippets — CI checks this is committed:
   ```bash
   npm run generate:autocomplete -w insomnia-scripting-environment
   ```

## Notes

- Common failure patterns and where to look:
  - `SECURITY_POLICY_VIOLATION` / script blocked for using `this`, `globalThis`, `__proto__`, `constructor`, or `import` → AST rule in `packages/insomnia/src/scripting/sandbox.ts` (`checkSandboxViolations`) or the rule lists in `script-security-rules.ts`. These are Electron-app-only; `inso` has no AST sandbox at all.
  - `no module is found for "..."` → the module isn't on the allowlist in `packages/insomnia/src/scripting/require-interceptor.ts`. Currently allowed:
    - Full-access Node builtins: `path`, `assert`, `url`, `punycode`, `querystring`, `string_decoder`, `stream`, `events`
    - Method-restricted Node builtins (some methods throw): `timers` (`setImmediate` blocked), `buffer` (`allocUnsafe`/`allocUnsafeSlow` blocked), `util` (`inherits`/`debuglog` blocked)
    - Shims: `atob`, `btoa`
    - External/npm modules: `ajv`, `chai`, `cheerio`, `crypto-js`, `csv-parse/lib/sync` (note: not bare `csv-parse`), `lodash` (backed by `es-toolkit/compat`), `moment`, `tv4`, `uuid`, `xml2js`
    - Special-cased: `insomnia-collection` / `postman-collection` (resolves to the SDK's own `Collection` module)

    Adding a module means adding it here, not just installing the npm package.
  - `Timeout: Running script took too long` (Electron app) → default 5000ms in `entry.hidden-window.ts:39` (`data.context.timeout`).
  - `insomnia object is invalid or script returns earlier than expected.` → thrown when the wrapped `AsyncFunction` doesn't resolve to an `InsomniaObject` instance; check both `run-script.ts` and `script-executor.ts` since the same invariant is duplicated in each path.
  - Hidden window "closed unexpectedly" / "froze" / busy errors → restart/health-check race conditions in `packages/insomnia/src/main/window-utils.ts` (`hiddenWindowIsBusy`, `createHiddenBrowserWindow`).
  - Works in unit tests but not in CI → confirm `npm run generate:autocomplete -w insomnia-scripting-environment` output matches the committed `autocomplete-snippets.json`; `test.yml` diffs this file and fails the build if it's stale.
- The script behavior should be as consistent as possible with [the original implementation](https://www.postmanlabs.com/postman-collection/tutorial-concepts.html). The implementation is hosted in this [repo](https://github.com/postmanlabs/postman-collection).
- CI workflows relevant to this feature: `.github/workflows/test.yml` (unit tests + autocomplete snippet check, runs on PR/push to develop), `.github/workflows/test-e2e.yml` (Playwright smoke tests, same triggers).
- Success criteria: the targeted vitest/Playwright command passes, and if the SDK surface changed, the autocomplete snippet diff is clean.
