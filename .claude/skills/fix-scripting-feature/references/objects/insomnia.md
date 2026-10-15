# InsomniaObject (`insomnia` / `pm`)

**Source:** `packages/insomnia-scripting-environment/src/objects/insomnia.ts`

## Purpose
This is the top-level scripting object: the single instance bound into the sandbox as `insomnia`
(with `$` as a Postman-compat alias — see Script-facing surface). It aggregates every other object
in this module (environments, variables, request, response, cookies, execution, request info,
vault, client certificates, test assertions) into one value that a pre-request / after-response /
test script reads and mutates, and that the runtime serializes back out via `toObject()` after the
script finishes.

## Public API

### `class InsomniaObject`

```ts
constructor(rawObj: {
  globals: Environment;
  baseGlobals: Environment;
  iterationData: Environment;
  environment: Environment;
  baseEnvironment: Environment;
  variables: Variables;
  request: ScriptRequest;
  settings: Settings;
  clientCertificates: ClientCertificate[];
  cookies: CookieObject;
  requestInfo: RequestInfo;
  execution: Execution;
  response?: ScriptResponse;
  parentFolders: ParentFolders;
  vault?: Vault;
})
```

Public/exposed properties:
- `environment: Environment` — the currently-selected environment.
- `collectionVariables: Environment` — **same object reference as `baseEnvironment`** (see Gotchas).
- `baseEnvironment: Environment` — the base (root) environment.
- `variables: Variables` — layered variable resolver (globals/env/collection/iteration/folder/local).
- `request: ScriptRequest` — the request being built/sent (`pm.request`).
- `cookies: CookieObject` — cookie jar wrapper (`pm.cookies`).
- `info: RequestInfo` — event/iteration metadata (`pm.info`).
- `response?: ScriptResponse` — present only in after-response/test scripts.
- `execution: Execution` — location/skip/next-request control (`pm.execution`).
- `vault?: Vault` — secret vault accessor, gated by `settings.enableVaultInScripts`.
- `clientCertificates: ClientCertificate[]` — raw client certs available to the request.

Private/internal properties (TypeScript-only — see Gotchas for why this doesn't restrict scripts at
runtime): `_expect` (chai `expect`), `_test`/`_skip` (from `./test`), `iterationData: Environment`,
`globals: Environment`, `baseGlobals: Environment` (marked
`// TODO: follows will be enabled after Insomnia supports them`), `_settings: Settings`,
`requestTestResults: RequestTestResult[]`, `parentFolders: ParentFolders`.

Methods:
- `sendRequest(request: string | ScriptRequest, cb: (error?: string, response?: ScriptResponse) => void)` — delegates to `sendRequest()` from `./send-request`, passing the internal `_settings`.
- `test = () => {}` — a no-op placeholder property; the *actual* behavior is installed by the
  constructor's `Proxy` (see below). Declaring this field exists mainly so `test` shows up as an
  own property.
- `expect = (exp: boolean | number | string | object) => this._expect(exp)` — thin pass-through to chai's `expect`.
- `get settings()` — **always returns `undefined`** (see Gotchas).
- `toObject = () => {...}` — serializes the whole object graph to a plain object: `globals`,
  `baseGlobals`, `environment`, `baseEnvironment`, `iterationData` (all via each `Environment`'s
  `toObject()`), `variables` (via `variables.localVarsToObject()`), `request`, `settings` (calls
  `this.settings`, i.e. always `undefined`), `clientCertificates`, `cookieJar` (via
  `cookies.jar().toInsomniaCookieJar()`), `info` (via `info.toObject()`), `response` (via
  `response.toObject()` or `undefined`), `requestTestResults`, `execution` (via
  `execution.toObject()`), `parentFolders` (via `parentFolders.toObject()`).

The constructor returns `new Proxy(this, { get: ... })`: any property access other than `'test'`
passes straight through via `Reflect.get`. Accessing `.test` instead returns a freshly-built
`TestHandler` function that calls `this._test(msg, fn, this.pushRequestTestResult)`, with a
`.skip` method that calls `this._skip(msg, fn, this.pushRequestTestResult)`. `pushRequestTestResult`
appends each `RequestTestResult` to the private `requestTestResults` array (immutably, via spread).

### `async function initInsomniaObject(rawObj: RequestContext, log: (...args: any[]) => void): Promise<InsomniaObject>`

Factory used by the script runner to build an `InsomniaObject` from a `RequestContext` snapshot
(see `interfaces.md`). Responsibilities, in order:
- Maps `globals`/`baseGlobals` — if the same environment id is selected for both, `globals` and
  `baseGlobals` become the *same* `Environment` instance; otherwise separate instances are created.
- Maps `environment`/`baseEnvironment` the same way; if no sub-environment is selected (ids equal),
  logs a warning via `log(...)` that mutations to `insomnia.environment` will apply to the base
  environment.
- Builds `iterationData` and `transientVariables`-backed local variables `Environment`s (defaulting
  to empty named environments when absent).
- Builds a `Vault` from `rawObj.vault` (or an empty object), gated by
  `rawObj.settings?.enableVaultInScripts` (defaults `false`).
- Builds `CookieObject` from `rawObj.cookieJar`.
- Builds `RequestInfo` from `rawObj.requestInfo` plus `rawObj.request.name`/`_id`.
- Builds `ParentFolders` from `rawObj.parentFolders`, then a `Variables` instance that layers
  base-global/global/environment/collection/iteration-data/folder-level/local variables.
- Resolves client certificates: uses `checkIfUrlIncludesTag` (from `./utils`) and
  `filterClientCertificates` (from `insomnia/src/network/certificate`) against `rawObj.request.url`.
  If the URL contains template tags or no certificate matches, initializes an **empty** default
  certificate and logs a warning via `getExistingConsole().warn(...)`; otherwise uses the first
  matched certificate.
- Builds the request URL (`toUrlObject`), proxy options (`transformToSdkProxyOptions`,
  `resolveProtocolForProxy`), adds query params, builds the auth via `toPreRequestAuth`, and
  constructs a `ScriptRequest`.
- Constructs an `Execution` from `rawObj.execution`.
- Reads the response body via `readBodyFromPath` and builds a `ScriptResponse` via
  `toScriptResponse` if `rawObj.response` is present.
- Returns `new InsomniaObject({...})` with everything above.

## Script-facing surface
`InsomniaObject` *is* what a script sees as the global `insomnia` object (and `$`, a Postman-compat
alias set up as `const $ = insomnia;` by the script wrapper in
`packages/insomnia/src/scripting/run-script.ts`). Nearly every `pm.*`/`insomnia.*` call in a script
routes through this object's properties/methods directly:
- `insomnia.environment`, `insomnia.collectionVariables`, `insomnia.baseEnvironment`, `insomnia.variables`
- `insomnia.request`, `insomnia.response`, `insomnia.cookies`, `insomnia.info`, `insomnia.execution`, `insomnia.vault`
- `insomnia.test(name, fn)` / `insomnia.test.skip(name, fn)`
- `insomnia.expect(value)`
- `insomnia.sendRequest(request, callback)`

`run-script.ts` requires the script's `insomnia` result to be `instanceof InsomniaObject` — if the
user script returns early or otherwise breaks that invariant, `runScript` throws
`'insomnia object is invalid or script returns earlier than expected.'`. After the script runs,
`InsomniaObject.toObject()` is used to merge mutations back into the persisted `RequestContext`.

## Gotchas / notable behavior
- **`collectionVariables` is not a copy** — `this.collectionVariables = this.baseEnvironment;` in
  the constructor means `insomnia.collectionVariables` and `insomnia.baseEnvironment` are the exact
  same `Environment` instance. Mutating one via a script mutates the other.
- **`insomnia.settings` is always `undefined`** — the `get settings()` accessor unconditionally
  `return;`s nothing, even though the real `Settings` object is held internally as `_settings` (used
  only for `sendRequest`'s proxy/certificate resolution). `toObject().settings` is therefore always
  `undefined` too, regardless of what `Settings` were passed in.
- **`globals`/`baseGlobals` are `private` in name only** — `private` is TypeScript-only and erased at runtime, and the constructor's `Proxy` forwards them (via `Reflect.get`, no `set` trap) same as any other property, so scripts can read *and* write `insomnia.globals`/`insomnia.baseGlobals` despite them being absent from the TS-declared public surface. Accidental exposure, not a supported feature.
- **The `test` proxy is easy to miss when reading the class** — the `test = () => {}` field looks
  like the real implementation, but any actual call to `insomnia.test(...)` is intercepted by the
  constructor's `Proxy` `get` trap before it ever reaches that field.
- **Certificate fallback is silent unless you check logs** — if the request URL contains
  `{{`/`}}`/`{%`/`%}` template tags, or no client certificate matches the host, an *empty* default
  certificate is substituted and a warning is written via the script console rather than thrown as
  an error.
- **No-environment-selected warning** — selecting the base environment (rather than a
  sub-environment) causes `initInsomniaObject` to log a warning that `insomnia.environment`
  mutations will land on the base environment, because `environment` and `baseEnvironment` are the
  same instance in that case.

## Related
- `interfaces.ts` — defines `RequestContext`, the input shape `initInsomniaObject` consumes.
- `execution.ts` — `Execution`, held as `insomnia.execution`.
- `request-info.ts` — `RequestInfo`, held as `insomnia.info`.
- `environments.ts` — `Environment`, `Variables`, `Vault` classes used throughout.
- `cookies.ts` — `CookieObject`, held as `insomnia.cookies`.
- `folders.ts` — `Folder`, `ParentFolders`, used for folder-level variables.
- `request.ts` — `Request`/`RequestOptions`/`toScriptRequestBody`, builds `insomnia.request`.
- `response.ts` — `toScriptResponse`, `readBodyFromPath`, builds `insomnia.response`.
- `send-request.ts` — implements `insomnia.sendRequest(...)`.
- `test.ts` — `test`/`skip`/`TestHandler`, implements `insomnia.test(...)`.
- `auth.ts` — `toPreRequestAuth`, used when building the request's auth config.
- `proxy-configs.ts` — `transformToSdkProxyOptions`, used for request proxy settings.
- `urls.ts` — `toUrlObject`, `resolveProtocolForProxy`.
- `utils.ts` — `checkIfUrlIncludesTag`, used for certificate-fallback detection.
- `console.ts` — `getExistingConsole`, used to log warnings.
- `packages/insomnia/src/scripting/run-script.ts` — binds this object as the sandbox global `insomnia` and calls `toObject()` after the script runs.
