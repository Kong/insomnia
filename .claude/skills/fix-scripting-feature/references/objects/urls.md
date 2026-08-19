# Url, QueryParam, UrlMatchPattern

**Source:** `packages/insomnia-scripting-environment/src/objects/urls.ts`

## Purpose

Models a request URL (`Url`), its individual query-string parameters (`QueryParam`), and Chrome-extension-style match patterns (`UrlMatchPattern` / `UrlMatchPatternList`) used to test whether a URL matches a proxy bypass rule or a client-certificate host rule. `pm.request.url` is a `Url`; `UrlMatchPattern` backs `ProxyConfig.match` and `Certificate.matches`.

## Public API

### `setUrlSearchParams(provider: any)`
Module-level override hook: replaces the `URLSearchParams` implementation used internally by `QueryParam` (defaults to the global `URLSearchParams`). Test-only utility, not script-facing.

### `QueryParamOptions` (interface)
`{ key: string; value?: string; type?: string; multiline?: string | boolean; disabled?: boolean; fileName?: string }`

### `QueryParam` (extends `Property`)
- `override _kind = 'QueryParam'`
- `key: string`, `value?: string`, `type?: string`, `multiline?: string | boolean`, `fileName?: string` (the latter two are noted in a comment as "properties from Insomnia... added here to avoid being dropped").
- `constructor(options: QueryParamOptions | string)` — if `options` is a string, it's `JSON.parse`d (wraps parse errors as `Error('invalid QueryParam options ...')`); if it's an object with `key`+`value`, fields are copied directly; otherwise **throws** `Error('unknown options for new QueryParam')`.
- `static override _index = 'key'`
- `static parse(queryStr: string): {key, value}[]` — parses a query string via `URLSearchParams`.
- `static parseSingle(paramStr: string, _idx?, _all?): {key, value}` — parses a single `key=value` pair; **throws** if `QueryParam.parse` yields nothing.
- `static unparse(params: QueryParamOptions[] | Record<string, string>): string` — builds a query string via `URLSearchParams`, URL-encoding as it goes.
- `static unparseSingle(obj: {key, value}): string | {}` — returns `''`-joined encoded `"key=value"` if the input has both `key` and `value`, otherwise returns `{}` (an empty object, not a string — inconsistent return type).
- `toString(): string` — URL-encodes via `URLSearchParams` (e.g. spaces become `+`).
- `toRawString(): string` — `"key=value"` with **no encoding**.
- `update(param: string | {key, value, type?})` — parses a string form via `parseSingle` (only sets `key`/`value`, coercing non-string results to `''`) or copies `key`/`value`/`type` from an object; **throws** on any other input shape.

### `UrlOptions` (interface)
`{ id?: string; auth?: {username, password}; hash?: string; host: string[]; path?: string[]; port?: string; protocol: string; query: {key, value}[]; variables: {key, value}[] }`

### `Url` (extends `PropertyBase`)
- `override _kind = 'Url'`
- `id?: string`
- Getters (all derived from an internal `URL` object, `this.urlObject`, which is `undefined` if the input couldn't be parsed as a URL — e.g. contains unrendered `{{ }}`/`{% %}` template tags): `auth` (`{username, password}` or `undefined`), `hash` (without leading `#`), `host` (hostname split on `.`), `path` (pathname segments, empty ones filtered out), `port`, `protocol`, `query: PropertyList<QueryParam>` (a **new** `PropertyList` wrapping the current query params on every access), `variables: string[]` (**always returns `[]`** — "TODO: it's usage is unknown").
- `constructor(def: UrlOptions | string)`
- `private initFields(urlOptions)` — parses `def`; if it's a string containing a template tag (`checkIfUrlIncludesTag`), it's kept as an opaque `origin` string and `urlObject` stays `undefined` (to avoid mangling `{% uuid 'v4' %}`-style tags); if it's an object, a URL string is assembled from `protocol`/`auth`/`host`/`port`/`path`/`query`/`hash` (protocol defaults to `'https://'` if blank). Query params are always parsed out into `this.queryParams` (a private array) separately from the `URL` object (whose own `search` is cleared) — "query params are handled separately as URL object encodes content".
- `static _index = 'id'`
- `static isUrl(obj: object): boolean`
- `static parse(urlStr: string): UrlOptions | undefined` — returns `undefined` if `URL.canParse` fails; `variables` is always `[]` in the result.
- `addQueryParams(params: QueryParamOptions[] | string)` — string form splits on `&` then `=` (not URL-decoded); array form copies each entry into a new `QueryParam`. **Throws** `TypeError` on other input.
- `getHost(): string` — `''` if the URL didn't parse.
- `getPath(_unresolved?): string` — `_unresolved` param is accepted but unused; `''` if unparsed.
- `getPathWithQuery(): string` — path + `?` + query string (or just the query string if path is blank).
- `getQueryString(): string` — joins **enabled** (`!disabled`) query params via `toRawString()` (i.e. **unencoded**, unlike `QueryParam.toString()`).
- `getRemote(_forcePort?): string` — `_forcePort` is accepted but unused; returns `urlObject.host` (which already includes the port when non-default) or `''`.
- `removeQueryParams(params: QueryParam[] | string[] | string)` — filters `this.queryParams` by key; **throws** `TypeError` on unrecognized input shape.
- `override toString(_forceProtocol?): string` — `_forceProtocol` accepted but unused; rebuilds the URL string with the current query string; falls back to the opaque `origin` string if unparsed; special-cases avoiding an added trailing `/` for root-path URLs.
- `toStringWithoutQuery(_forceProtocol?): string` — same as `toString()` but with `search` cleared.
- `update(url: UrlOptions | string)` — re-runs `initFields`.

### `UrlMatchPattern` (extends `Property`)
Implements [Chrome extension match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) (`scheme://host/path`, wildcards, `<all_urls>`); comment notes it doesn't support top-level-domain wildcards, and that URLs can't start with `-` (unenforced).
- `override id = ''`
- `constructor(pattern: string)`
- `static override _index = 'id'`
- `static readonly MATCH_ALL_URLS = '<all_urls>'`
- `static pattern: string | undefined = undefined` — declared but unused ("TODO: its usage is unknown"); shadowed by (unrelated to) the instance's private `pattern`.
- `static readonly PROTOCOL_DELIMITER = '+'` — multiple schemes are written as `http+https+custom://...`.
- `getProtocols(): string[]` — `['http', 'https', 'file']` for `<all_urls>`; otherwise splits the scheme segment on `+`.
- `test(urlStr: string): boolean` — true only if protocol, host, path, and port all match.
- `testHost(hostStr: string): boolean` — segment-by-segment comparison against the pattern's host (split on `.`); a segment of `*` matches anything; segment **counts must match exactly** (no subdomain-wildcard-prefix support beyond single-segment `*`).
- `testPath(pathStr: string): boolean` — segment-by-segment comparison (split on `/`); segment counts must match exactly; `*` matches any single segment.
- `testPort(port: string, protocol: string): boolean` — returns `false` immediately if `testProtocol(protocol)` fails; `*` in the pattern matches any port; if no port is specified in either the pattern or input, falls back to protocol-default-port logic for `http`/`https` only.
- `testProtocol(protocol: string): boolean` — `*` in the pattern matches any protocol.
- `override toString(): string` — returns the raw pattern string.
- `update(pattern: string)`

### `UrlMatchPatternList<T extends UrlMatchPattern>` (extends `PropertyList<T>`)
- `override _kind = 'UrlMatchPatternList'`
- `constructor(parent: PropertyList<T> | undefined, populate: T[])`
- `static isUrlMatchPatternList(obj: any): boolean`
- `test(urlStr: string): boolean` — true if **any** pattern in the list matches.

### Module-level functions
- `toUrlObject(url: string | Url): Url` — **throws** `Error('Request URL is not specified')` if `url` is falsy; passes through an existing `Url` unchanged, otherwise constructs a new one from a string.
- `resolveProtocolForProxy(rawUrl: string): string` — resolves the protocol to use for proxy selection when the URL may still contain unrendered template tags (pre-request scripts run before rendering); tries `new URL(rawUrl).protocol` first, falling back to `'https:'` on parse failure.

## Script-facing surface

`pm.request.url` is a `Url` instance. Common script usage:
- `pm.request.url.toString()`, `pm.request.url.getHost()`, `pm.request.url.getPath()`, `pm.request.url.query`
- `pm.request.url.addQueryParams([{key, value}])` / `pm.request.addQueryParams(...)` (delegates)
- `pm.request.url.removeQueryParams('key')` / `pm.request.removeQueryParams(...)` (delegates)
- `pm.request.url.hash`, `.host`, `.port`, `.protocol`, `.auth`

`QueryParam` instances populate `pm.request.url.query` and `RequestBody.urlencoded`.

`UrlMatchPattern`/`UrlMatchPatternList` aren't constructed directly from a typical script, but are reachable via `pm.request.proxy.match` (see `proxy-configs.ts`) and `pm.request.certificate.matches` (see `certificates.ts`) — both store their match rule(s) as `UrlMatchPattern`/`UrlMatchPatternList` internally.

## Gotchas / notable behavior

- `Url.variables` **always returns `[]`**, even though `UrlOptions.variables` and `Url.parse()`'s return both have a `variables` field — the field is accepted on input but silently discarded; there is no way to read it back out.
- `Url`'s internal `urlObject` (a real `URL`) is `undefined` whenever the input string contains a template tag (`{{ }}` / `{% %}`) or otherwise fails `URL.canParse` — in that case nearly every getter/method (`host`, `path`, `port`, `protocol`, `getHost()`, `getRemote()`, etc.) silently returns an empty string/array instead of throwing. Only `toString()`/`toStringWithoutQuery()` fall back to the raw `origin` string.
- Query-string encoding is inconsistent by design: `QueryParam.toString()` URL-encodes (via `URLSearchParams`), but `QueryParam.toRawString()` and `Url.getQueryString()` (which uses `toRawString()`) do **not** encode. `Url.addQueryParams(stringForm)` also splits on raw `&`/`=` without decoding.
- `QueryParam.unparseSingle()` returns `{}` (not a string) when the input lacks `key`/`value` — inconsistent return type (`string | {}`) that callers must handle.
- Several methods accept parameters that are **entirely unused**: `Url.getPath(_unresolved)`, `Url.getRemote(_forcePort)`, `Url.toString(_forceProtocol)`, `Url.toStringWithoutQuery(_forceProtocol)`, `QueryParam.parseSingle(_idx, _all)`. Passing anything for these has no effect.
- `UrlMatchPattern.static pattern` (class-level) is unused/dead and easy to confuse with the instance's own private `pattern` field.
- `UrlMatchPattern.testHost`/`testPath` require the **segment counts to match exactly** — a pattern like `*.insomnia.com` (2 segments) will not match `bin.download.insomnia.com` (4 segments), confirmed by the test suite (`urls.test.ts`).
- `UrlMatchPattern` has no protocol-agnostic short-circuit: calling `testProtocol` on a pattern with no `://` returns `[]` for `getProtocols()`, meaning `testProtocol` always returns `false` for such a malformed pattern (per `urls.test.ts`, "no protocol" case).

## Related

- `packages/insomnia-scripting-environment/src/objects/properties.ts` — `Property`, `PropertyBase`, `PropertyList` base classes; `PropertyList.toObject()`'s fallback comment specifically calls out `UrlMatchPatternList` as a list with no natural key.
- `packages/insomnia-scripting-environment/src/objects/utils.ts` — `checkIfUrlIncludesTag`, used by `Url.initFields` to avoid mangling template tags.
- `packages/insomnia-scripting-environment/src/objects/request.ts` — `Request.url: Url`; `toUrlObject` used when constructing a `Request`; `RequestBody.urlencoded: PropertyList<QueryParam>`.
- `packages/insomnia-scripting-environment/src/objects/certificates.ts` — `Certificate.matches: UrlMatchPatternList<UrlMatchPattern>`.
- `packages/insomnia-scripting-environment/src/objects/proxy-configs.ts` — `ProxyConfig.match` constructs a `UrlMatchPattern`; `ProxyConfig.bypass: UrlMatchPatternList`.
- `packages/insomnia-scripting-environment/src/objects/collection.ts` — re-exports `QueryParam`, `Url`, `UrlMatchPattern`, `UrlMatchPatternList` as part of the public collection API surface.
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — uses `resolveProtocolForProxy` and `toUrlObject` in `initInsomniaObject`.
