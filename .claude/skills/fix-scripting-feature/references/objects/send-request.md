# sendRequest (pm.sendRequest)

**Source:** `packages/insomnia-scripting-environment/src/objects/send-request.ts`

## Purpose
Implements the standalone `sendRequest()` function that backs `pm.sendRequest()` / `insomnia.sendRequest()` — letting a pre-request/after-response script fire an ad-hoc HTTP request (via libcurl) and get a `Response` back, either through a Node-style callback or a returned promise. It also contains the translation layer from the SDK's `Request`/string/`RequestOptions` shapes into the curl request options consumed by Insomnia's network layer, and from the raw curl output back into a `Response` object.

## Public API

### `sendRequest(request, cb, settings)`
```ts
export async function sendRequest(
  request: string | Request | RequestOptions,
  cb: (error?: string, response?: Response) => void,
  settings: Settings,
): Promise<Response | void>
```
- Builds curl options from `request` via `requestToCurlOptions(request, settings)`.
- Picks the curl execution path based on environment: in the renderer (`__IS_RENDERER__` true) it uses `window.bridge.curlRequest`; otherwise it dynamically imports `curlRequest` from `insomnia/src/main/network/libcurl-promise`.
- Awaits the curl call, converts the raw `CurlRequestOutput` to a `Response` via `curlOutputToResponse(output, request)`.
- **Success:** if `cb` is provided, calls `cb(undefined, transformedOutput)`; either way resolves the returned promise with `transformedOutput`.
- **Failure:** if `cb` is provided, calls `cb(e)` and resolves the promise with `undefined` (does **not** reject); if no `cb` is provided, rejects the promise with `e`.

### `requestToCurlOptions(req, settings)` (not exported)
```ts
function requestToCurlOptions(req: string | Request | RequestOptions, settings: Settings)
```
- If `req` is a `string`: treats it as a bare URL, builds a minimal GET request object (`no body`, `noauth`, empty headers/cookies, `settingRebuildPath: true`, `settingSendCookies: true`, `settingFollowRedirects` derived from `settings.followRedirects ? 'on' : 'off'`), with `requestId` prefixed `pre-request-script-adhoc-req-simple:<uuid>`.
- If `req` is a `Request` instance or a plain object (`RequestOptions`): coerces to a `Request` (`new Request(req)` if not already one), derives `mimeType` from `finalReq.body.mode` (`raw`→`text/plain`, `file`→`application/octet-stream`, `formdata`→`multipart/form-data`, `urlencoded`→`application/x-www-form-urlencoded`, `graphql`→`application/json`, otherwise `text/plain`), maps headers/body/certificate/auth into the curl request shape, with `requestId` = `finalReq.id` or a generated `pre-request-script-adhoc-req-custom:<uuid>`.
- Auth mapping beyond `noauth` is largely commented out / marked `TODO` (see Gotchas).
- Throws `Error('the request type must be: string | Request | RequestOptions.')` for any other input shape.

### `curlOutputToResponse(result, request)` (not exported)
```ts
async function curlOutputToResponse(
  result: CurlRequestOutput,
  request: string | Request | RequestOptions,
): Promise<Response>
```
- Throws if `result.headerResults` is empty, or if `result.patch.error` is set (re-throws that error), or if there's no last redirect entry.
- Normalizes `request` into a `Request` instance for `originalRequest`.
- Extracts headers from the last redirect's `headerResults` entry; parses any `Set-Cookie` headers via `tough-cookie`'s `Cookie.parse(..., { loose: true })` into cookie option objects (filtering out unparsable ones).
- If `result.responseBodyPath` is absent, returns a `Response` with `body: ''`.
- Otherwise reads the body via `services.helpers.readCurlResponse({ bodyPath, bodyCompression })`; throws if that read reports an error; otherwise returns a fully populated `Response` (`code`, `reason`, `header`, `cookie`, `body`, `responseTime: result.patch.elapsedTime`, `originalRequest`). `stream` is always left `undefined` ("because it is inaccurate to differentiate if body is binary").

## Script-facing surface
- `pm.sendRequest(url, (err, response) => { ... })` — string URL, GET request, callback style.
- `pm.sendRequest({ url, method, header, body, auth, ... }, (err, response) => { ... })` — full `RequestOptions`-shaped object.
- `pm.sendRequest(requestInstance, (err, response) => { ... })` — passing an existing `Request` instance (e.g. built via `new Request(...)` or `pm.request`).
- Can also be used promise-style without a callback: `const response = await pm.sendRequest(url)` (see Gotchas for the resulting error-handling difference).
- Exposed on the object model as `insomnia.sendRequest(request, cb)`, which is a plain instance method (not proxy-trapped) that forwards to this file's `sendRequest(request, cb, this._settings)`.

## Gotchas / notable behavior
- **Callback vs. promise error handling differ:** if a `cb` is supplied, network/parsing errors are *swallowed* into the callback (`cb(e)`) and the returned promise still resolves (with `undefined`) — it will not reject. If no `cb` is supplied, the same error instead rejects the returned promise. A script mixing `await pm.sendRequest(url, cb)` with `try/catch` will not catch curl errors, because the promise resolves successfully even on failure when a callback is present.
- **Environment branching:** `__IS_RENDERER__ ? window.bridge.curlRequest : (await import('insomnia/src/main/network/libcurl-promise')).curlRequest` — the actual network call goes through completely different code paths depending on whether the script executes in the renderer (Electron IPC bridge) or Node/main context. Bugs that only reproduce in one context (e.g. inso CLI vs. the desktop app) may live in this branch.
- **Auth beyond `noauth` is not wired up** for the custom-`Request` branch: there's a large commented-out block (`// const authHeaders = ...`) showing API-key/bearer header injection was planned but not implemented; `fromPreRequestAuth(finalReq.auth)` is still called and passed through as `authentication`, but the `authHeader` field of the curl options is always `undefined` with a `// TODO: add this for bearer and other auth methods` comment.
- **Certificates:** only a single client certificate is forwarded (`finalReq.certificate`), built directly into the curl options' `certificates` array; several fields (`disabled`, `isPrivate`, `_id`, `type`, `parentId`, `modified`, `created`, `name`) are hardcoded to empty/`false`/`0` since they're "unused fields because they are not persisted".
- **Cookies are not populated from a jar** — `cookieJar: { cookies: [] }` and `cookies: []` are always empty in the outgoing request; the comment notes "currently cookies should be handled by user in headers". Response `Set-Cookie` headers are still parsed back out via `tough-cookie`, though.
- **`suppressUserAgent` detection** only checks for a *disabled* `User-Agent` header (`h.key.toLowerCase() === 'user-agent' && h.disabled === true`) — an enabled custom `User-Agent` header does not suppress the default one; it presumably just overrides via normal header precedence.
- **Response body/stream:** `stream` is always `undefined` in the returned `Response`, even though `CurlRequestOutput`/`ResponseOptions` support it, specifically to avoid ambiguity between binary and text bodies — callers should rely on `body` (a string) only.

## Related
- `packages/insomnia-scripting-environment/src/objects/request.ts` — `Request`, `RequestOptions`, `RequestBody`/`RequestBodyOptions` types this function consumes as input.
- `packages/insomnia-scripting-environment/src/objects/response.ts` — `Response` class this function constructs as output.
- `packages/insomnia-scripting-environment/src/objects/auth.ts` — `RequestAuth`, `fromPreRequestAuth` used to translate the SDK's auth model into the curl request's `authentication` field.
- `packages/insomnia-scripting-environment/src/objects/cookies.ts` — `CookieOptions` type used for parsed `Set-Cookie` results.
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — exposes this function as `insomnia.sendRequest(request, cb)`, supplying `this._settings` as the `settings` argument.
- `insomnia/src/main/network/libcurl-promise` (`curlRequest`, `CurlRequestOutput`) — the main/Node-side curl execution path, dynamically imported when not running in the renderer.
- `window.bridge.curlRequest` — the renderer-side IPC bridge equivalent used when `__IS_RENDERER__` is true.
- `insomnia-data` (`services.helpers.readCurlResponse`, `Settings` type) — used to read the response body from disk (`responseBodyPath`) and for the `Settings` (e.g. `followRedirects`) passed in.
