# Request, RequestBody

**Source:** `packages/insomnia-scripting-environment/src/objects/request.ts`

## Purpose

Models the outgoing HTTP request as seen/mutated by pre-request and test scripts: `pm.request` / `insomnia.request`. Also holds the merge/serialization logic that converts between this script-facing `Request` shape and Insomnia's own `insomnia-data` request model (`mergeRequests`, `mergeRequestBody`, `mergeSettings`, `mergeClientCertificates`), and payload-size calculation used by `Request.size()` / `Response.size()`.

## Public API

### `FormParam` (extends `Property`)
- `constructor(options: { key: string; value: string; type?: string; disabled?: boolean })`
- `key: string`, `value: string`, `type?: string`
- `static _postman_propertyAllowsMultipleValues()` — **always throws** `Error('unsupported')`.
- `static _postman_propertyIndexKey()` — **always throws** `Error('unsupported')`.
- `toJSON()` — `{ key, value, type, disabled }`.
- `toString()` — `"key=value"` with both parts `encodeURIComponent`-escaped.
- `valueOf()` — returns `value`.

### `RequestBodyOptions` (interface)
`{ mode: RequestBodyMode; file?: string; formdata?: {key,value,type?,disabled?}[]; graphql?: {query,operationName,variables,disabled?}; raw?: string; urlencoded?: {key,value?,type?,disabled?,multiline?,fileName?}[]; options?: object }`
`RequestBodyMode = undefined | 'formdata' | 'urlencoded' | 'raw' | 'file' | 'graphql'`.

### `RequestBody` (extends `PropertyBase`)
- `constructor(opts: RequestBodyOptions)`
- `mode: RequestBodyMode`, `file?: string`, `formdata?: PropertyList<FormParam>`, `graphql?: {query,operationName,variables}`, `raw?: string`, `urlencoded?: PropertyList<QueryParam>`, `options?: object`
- `isEmpty(): boolean` — switches on `mode` and checks whether the matching field is `null`; **throws** `Error` if `mode` isn't one of the five known modes.
- `toString()` — renders body as a string per `mode` (`formdata`/`urlencoded` join their `PropertyList` entries with `&`, `graphql` is `JSON.stringify`-ed); wraps any internal error as `Error("toString: ...")`; returns `''` if `mode` is `undefined`.
- `update(opts: RequestBodyOptions)` — re-derives and replaces all fields (same logic as constructor).

### `RequestOptions` (interface)
`{ url: string | Url; method?: string; header?: HeaderDefinition[] | object; body?: RequestBodyOptions; auth?: AuthOptions; proxy?: ProxyConfigOptions; certificate?: CertificateOptions; pathParameters?: RequestPathParameter[]; name?: string }`

### `RequestSize` (interface)
`{ body: number; header: number; total: number; source: string }`

### `Request` (extends `Property`)
- `constructor(options: RequestOptions)` — sets `_kind = 'Request'`; `method` defaults to `'GET'` if omitted; `header` accepts either an array of `HeaderDefinition` or a plain `{key: value}` object (converted to `Header`s); `auth` defaults to `{ type: 'noauth' }`.
- Properties: `name: string`, `url: Url`, `method: string`, `headers: HeaderList<Header>`, `body?: RequestBody`, `auth: RequestAuth`, `proxy?: ProxyConfig`, `certificate?: Certificate`, `pathParameters: RequestPathParameter[]`.
- `static isRequest(obj: object): boolean` — checks `_kind === 'Request'`.
- `addHeader(header: Header | object)` — accepts a `Header` instance or `{key, value}`; **throws** `Error` otherwise.
- `addQueryParams(params: QueryParam[] | string)` — delegates to `this.url.addQueryParams`.
- `authorizeUsing(authType: AuthOptionTypes | AuthOptions, options?: VariableList<Variable>)` — delegates to `this.auth.use(...)`.
- `clone(): Request` — `new Request({ ...this.toJSON() })` (JSON round-trip clone, not a deep object clone).
- `forEachHeader(callback: (header: Header, context?: object) => void)` — delegates to `this.headers.each`.
- `getHeaders(options?: { ignoreCase, enabled, multiValue, sanitizeKeys }): Record<string, string[] | string>` — merges headers with the same key into an array; `ignoreCase` lowercases keys before merging; `enabled` filters out headers where `disabled` is truthy; `sanitizeKeys` drops headers with a falsy `value`.
- `removeHeader(toRemove: string | Header, options?: { ignoreCase: boolean })` — rebuilds `this.headers` as a new `HeaderList` excluding matches; **throws** if `toRemove` isn't `string | Header`.
- `removeQueryParams(params: string | string[] | QueryParam[])` — delegates to `this.url.removeQueryParams`.
- `size(): RequestSize` — `calculatePayloadSize(this.body?.toString() ?? '', this.headers)`.
- `toJSON()` — plain object snapshot (`url` as string, `header` array, `body`, `auth`, `proxy`, `certificate`).
- `update(options: RequestOptions)` — re-derives and replaces every field.
- `upsertHeader(header: HeaderDefinition)` — removes any existing header with the same `key` (case-sensitive), then appends a new `Header`.

### Module-level functions
- `mergeSettings(originalSettings: Settings, updatedReq: Request): Settings` — if `updatedReq.proxy` is enabled (not disabled and has a non-empty proxy URL), overrides both `httpProxy` and `httpsProxy` in the returned `Settings` with the same proxy URL; otherwise returns `originalSettings` unchanged.
- `mergeClientCertificates(originalClientCertificates: ClientCertificate[], updatedReq: Request): ClientCertificate[]` — maps the script's single `updatedReq.certificate` onto Insomnia's certificate list (which supports multiple). Returns originals unchanged if no certificate was set (or it's empty). **Throws** `Error('Invalid certificate configuration: "cert+key" and "pfx" can not be set at the same time')` if neither a valid `pfx` nor a valid `cert`+`key` pair is present in the certificate.
- `toScriptRequestBody(insomniaReqBody: InsomniaRequestBody): RequestBodyOptions` — converts Insomnia's native request body (`text` / `fileName` / `params`) into a `RequestBodyOptions` (`raw` / `file` / `urlencoded`); `formdata` and `graphql` modes are not produced here.
- `mergeRequestBody(updatedReqBody: RequestBody | undefined, originalReqBody: InsomniaRequestBody): InsomniaRequestBody` — infers `mimeType` from `updatedReqBody.mode` (falls back to `originalReqBody.mimeType` if set); **throws** on an unknown `mode`; wraps any other failure as `Error("failed to update body: ...")`.
- `mergeRequests(originalReq: InsomniaRequest, updatedReq: Request): InsomniaRequest` — builds the outgoing Insomnia request from the script's mutated `Request`: `url` via `toStringWithoutQuery()`, `parameters` from `url.query`, `headers` from `headers`, `authentication` via `fromPreRequestAuth`, `pathParameters` copied as-is, and **hardcodes `preRequestScript: ''`** (i.e., the merged request never carries a pre-request script forward).
- `calculatePayloadSize(body: string, headers: HeaderList<Header>): RequestSize` — body size via `new Blob([body]).size`; `source` is always `'COMPUTED'`.
- `calculateHeadersSize(headers: HeaderList<Header>): number` — `Blob` size of all headers joined as `"key: value\n"` lines (via each header's `toString()`, which is `Header`'s inherited/overridden behavior).

## Script-facing surface

`insomnia.request` / `pm.request` is a live `Request` instance (constructed in `insomnia.ts#initInsomniaObject`). Common script usage:
- `pm.request.url`, `pm.request.method`, `pm.request.headers`, `pm.request.body`
- `pm.request.headers.add(...)`, `pm.request.addHeader({key, value})`, `pm.request.upsertHeader({key, value})`, `pm.request.removeHeader('X-Foo')`
- `pm.request.url.addQueryParams(...)` / `pm.request.addQueryParams(...)`, `pm.request.removeQueryParams(...)`
- `pm.request.auth`, `pm.request.authorizeUsing('basic', ...)`
- `pm.request.size()` — payload size info
- Any mutation a pre-request script makes to `pm.request` is read back and merged into the real outgoing request via `mergeRequests` / `mergeRequestBody` / `mergeSettings` / `mergeClientCertificates` after the script finishes.

## Gotchas / notable behavior

- `FormParam._postman_propertyAllowsMultipleValues()` and `_postman_propertyIndexKey()` are stubs that **always throw** — calling them from a script (unlikely, but they exist statically) will always fail. A commented-out `static parse` is also noted as "not supported yet in existing scripts".
- `RequestBody.isEmpty()` / `toString()` both `throw` if `mode` doesn't match one of the five known literals — an unexpected/typo'd `mode` string surfaces as a runtime error, not silently.
- `Request.getHeaders()`'s `multiValue` option is part of the signature but **is never referenced in the function body** — the implementation always accumulates same-key headers into an array regardless of what `multiValue` is set to.
- `Request.removeHeader` and `upsertHeader` rebuild `this.headers` as an entirely new `HeaderList` rather than mutating in place.
- `Request.clone()` is a JSON round-trip (`toJSON()` → `new Request(...)`), not a structural/deep clone — anything not captured by `toJSON()` is lost on clone.
- `mergeRequests` **always sets `preRequestScript: ''`** on the merged request — a deliberate design choice worth knowing if debugging "script disappeared" reports downstream.
- `mergeClientCertificates` throws if a script sets both `cert`+`key` and `pfx` on `pm.request.certificate` at the same time — Insomnia only supports one or the other.
- `toScriptRequestBody` only produces `raw` / `file` / `urlencoded` modes; there's no path from Insomnia's native body model to script `formdata`/`graphql` modes in this function.

## Related

- `packages/insomnia-scripting-environment/src/objects/headers.ts` — `Header`, `HeaderList` used for `Request.headers`.
- `packages/insomnia-scripting-environment/src/objects/urls.ts` — `Url`, `QueryParam`, `toUrlObject` used for `Request.url` and `RequestBody.urlencoded`.
- `packages/insomnia-scripting-environment/src/objects/auth.ts` — `RequestAuth`, `fromPreRequestAuth` used for `Request.auth`.
- `packages/insomnia-scripting-environment/src/objects/certificates.ts` — `Certificate` used for `Request.certificate`.
- `packages/insomnia-scripting-environment/src/objects/proxy-configs.ts` — `ProxyConfig` used for `Request.proxy`.
- `packages/insomnia-scripting-environment/src/objects/properties.ts` — `Property`, `PropertyBase`, `PropertyList` base classes.
- `packages/insomnia-scripting-environment/src/objects/variables.ts` — `Variable`, `VariableList` used by `authorizeUsing`.
- `packages/insomnia-scripting-environment/src/objects/response.ts` — imports `calculateHeadersSize`; `Response.originalRequest` is a `Request`.
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — constructs `pm.request` in `initInsomniaObject`.
