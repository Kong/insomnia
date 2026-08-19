# Response

**Source:** `packages/insomnia-scripting-environment/src/objects/response.ts`

## Purpose

Models the HTTP response as seen by after-response and test scripts: `pm.response` / `insomnia.response`. It wraps the raw body/headers/cookies/timing data returned by the network layer, provides parsing/introspection helpers (`json()`, `contentInfo()`, `size()`), and extends `chai`'s assertion API with Postman-style response assertions (`pm.response.to.have.status(200)`, etc.). `pm.response` is only populated for after-response/test scripts — it's `undefined` during pre-request scripts.

## Public API

### `ResponseOptions` (interface)
`{ code: number; reason?: string; header?: HeaderDefinition[]; cookie?: CookieOptions[]; body?: string; stream?: Buffer | ArrayBuffer; responseTime: number; originalRequest: Request; bytesRead?: number }`

### `ResponseContentInfo` (interface)
`{ mimeType: string; mimeFormat: string; charset: string; fileExtension: string; fileName: string; contentType: string }`

### `Response` (extends `Property`)
- `constructor(options: ResponseOptions)` — sets `_kind = 'Response'`; `body` defaults to `''`; `status` defaults to `options.reason`, falling back to `RESPONSE_CODE_REASONS[options.code]`, falling back to `''`; `bytesRead` (private) defaults to `0`.
- Properties: `body: string`, `code: number`, `cookies: CookieList`, `headers: HeaderList<Header>`, `originalRequest: Request`, `responseTime: number`, `status: string`, `stream?: Buffer | ArrayBuffer`; `bytesRead` is **private**.
- `static createFromNode(response: {...}, cookies: CookieOptions[]): Response` — builds a `Response` from a raw Node-style response object (`body`, `headers`, `statusCode`, `statusMessage`, `elapsedTime`, `originalRequest`, `stream`).
- `static isResponse(obj: object): boolean` — checks `_kind === 'Response'`.
- `contentInfo(): ResponseContentInfo` — parses the `Content-Type` header for `mimeType`/`charset` (defaults: `application/octet-stream` / `utf8`) and the `Content-Disposition` header for `fileName`/`fileExtension`. **Throws** if a `Content-Type` header exists but its value is blank, or its mime-type segment is empty.
- `dataURI(): string` — builds a `data:` URI string from `contentInfo().contentType` and `this.stream || this.body`. **Throws** if neither `stream` nor `body` is set.
- `json(reviver?: (key, value) => any, _strict?: boolean): any` — `JSON.parse(this.body.toString(), reviver)`; wraps parse failures as `Error("json: failed to parse: ...")`. `_strict` is accepted but unused ("TODO: enable strict after common module is introduced").
- `jsonp(_reviver?, _strict?)` — **always throws** `unsupportedError('jsonp()')`.
- `reason(): string` — returns `this.status`.
- `size(): { body: number; header: number; total: number; source: 'COMPUTED' }` — `body` is the private `bytesRead` value (not derived from `this.body`'s actual length); `header` via `calculateHeadersSize(this.headers)`.
- `text(): string` — `this.body.toString()`.
- `get to()` — returns a `chai.Assertion` wrapping `this`, with Postman-style properties/methods registered onto `chai.Assertion.prototype` on every access: properties `withBody`, `error` (true if `code` is within 400–500 inclusive), `ok` (true if `code === 200`), `json` (true if the body parses to an object); methods `status(val)`, `header(headerName)`, `body(bodyContent)`, `jsonBody(propName)`, `jsonSchema(schema, options?)` (uses `ajv` to validate `this.json()` against `schema`).

### Module-level functions
- `toScriptResponse(originalRequest: Request, partialInsoResponse: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError, responseBody: string): Response | undefined` — returns `undefined` if `partialInsoResponse` is an error result (network/curl failure); otherwise builds a `Response`, extracting `Set-Cookie` headers into `Cookie.parse(...)` entries for `cookie`.
- `readBodyFromPath(response: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError | undefined): Promise<string>` — returns `''` if `response` is missing, an error, or has no `bodyPath`; otherwise reads and decompresses the body from disk via `services.helpers.readCurlResponse`. **Throws** if that read reports an error.

## Script-facing surface

`insomnia.response` / `pm.response` is a `Response` instance, present only in after-response/test scripts (constructed in `insomnia.ts#initInsomniaObject` via `toScriptResponse`; `undefined` if the request errored or during pre-request scripts). Common script usage:
- `pm.response.code`, `pm.response.status`, `pm.response.headers`, `pm.response.body`
- `pm.response.json()`, `pm.response.text()`, `pm.response.contentInfo()`
- `pm.response.to.have.status(200)`, `pm.response.to.have.header('Content-Type')`, `pm.response.to.have.jsonBody('key')`, `pm.response.to.not.have.status(404)`, `pm.response.to.have.jsonSchema({...})`

## Gotchas / notable behavior

- `dataURI()` has a typo in the returned string: it emits `` `data:${contentType};baseg4, ${bodyInBase64}` `` — **`baseg4` instead of `base64`**. Any consumer relying on `dataURI()` producing a spec-compliant data URI will get a malformed one.
- `jsonp()` is a stub that always throws `unsupportedError('jsonp()')` — it exists on the type but is never functional.
- `size().body` comes from the **private `bytesRead`** field (set once at construction from `options.bytesRead`, defaulting to `0`), not from measuring `this.body`. If `bytesRead` wasn't passed in, `size()` reports `0` regardless of actual body length. (The test file has a commented-out assertion noting `resp.size()` doesn't fully work yet: `"this will work after PropertyList.one is improved"`.)
- The `error` assertion (`pm.response.to.have.error` / `.to.be.error`) only covers status codes **400–500 inclusive** — not the broader 4xx/5xx range one might expect.
- `get to()` re-registers the chai plugin (`chai.use(...)`) on **every property access**, not once — functionally harmless (chai plugin registration is idempotent per-call) but means the closure/plugin functions are recreated each time `.to` is read.
- `contentInfo()` throws if a `Content-Type` header is present but empty/malformed; scripts that blindly call `pm.response.contentInfo()` on unusual responses can throw.
- `toScriptResponse` returns `undefined` on network error — scripts must handle `pm.response` potentially being `undefined` (though in practice after-response/test scripts only run when a response exists).

## Related

- `packages/insomnia-scripting-environment/src/objects/request.ts` — `Response.originalRequest: Request`; imports `calculateHeadersSize` from here.
- `packages/insomnia-scripting-environment/src/objects/headers.ts` — `Header`, `HeaderList` for `Response.headers`.
- `packages/insomnia-scripting-environment/src/objects/cookies.ts` — `Cookie`, `CookieList` for `Response.cookies`.
- `packages/insomnia-scripting-environment/src/objects/properties.ts` — `Property`, `unsupportedError`.
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — constructs `pm.response` in `initInsomniaObject` via `toScriptResponse`/`readBodyFromPath`.
