# ProxyConfig, ProxyConfigList

**Source:** `packages/insomnia-scripting-environment/src/objects/proxy-configs.ts`

## Purpose
Models a single proxy configuration (`pm.request.proxy`) and a keyed list of them (`ProxyConfigList`, exported for scripts to build their own lists, e.g. via `require('insomnia-collection')`). Also provides `transformToSdkProxyOptions`, the function that converts Insomnia's native proxy settings (`httpProxy`/`httpsProxy`/`proxyEnabled`/`noProxy` strings from Settings) into the SDK's `ProxyConfigOptions` shape used to seed `pm.request.proxy`.

## Public API

### Types
- `interface ProxyConfigOptions { match: string; host: string; port?: number; tunnel: boolean; disabled?: boolean; authenticate: boolean; username: string; password: string; bypass?: string[]; protocol: string }` — constructor input for `ProxyConfig`. `match` is a URL match pattern string (see `urls.ts`) initializing a `UrlMatchPattern` internally, e.g. `'http+https://example.com/*'`. `bypass` and `protocol` are called out in comments as "for compatibility with Insomnia".

### `class ProxyConfig extends Property`
- `override _kind = 'ProxyConfig'`
- `host: string`
- `match: string` — the raw match-pattern string (not a `UrlMatchPattern` instance on the instance property, though a `UrlMatchPattern` is constructed on the fly inside `getProtocols()`/`test()`).
- `port?: number`
- `tunnel: boolean`
- `authenticate: boolean`
- `username: string`
- `password: string`
- `bypass: string[]` — list of hosts/URLs to bypass the proxy for; comment: "for compatibility with Insomnia's bypass list".
- `protocol: string` — e.g. `"http"`/`"https"`.
- `static authenticate = false`, `static bypass: UrlMatchPatternList<UrlMatchPattern> = new UrlMatchPatternList(undefined, [])`, `static host = ''`, `static match = ''`, `static password = ''`, `static port?: number = undefined`, `static tunnel = false` (comment: "unsupported"), `static username = ''`, `static protocol = 'https:'` — all marked `@ignore` in JSDoc with the comment "following properties are hidden as they are not used while must be exposed". These are class-level defaults, distinct from the instance properties of the same name.
- `constructor(def: { id?: string; name?: string; match: string; host: string; port?: number; tunnel: boolean; disabled?: boolean; authenticate: boolean; username: string; password: string; bypass?: string[]; protocol: string })` — sets `id`/`name` from `def` or defaults to `''`, `disabled` defaults to `false`, `bypass` defaults to `[]` if omitted. All other fields copied straight through (no defaulting).
- `static override _index = 'key'` — Note: `ProxyConfig` has no instance field literally named `key`; `PropertyList.indexOf()`/`.one()` would look for a `key` property on the record, which doesn't exist on `ProxyConfig` — see Gotchas. (`ProxyConfigList.toObject()` keys its map by `match`, not by this `_index`.)
- `static isProxyConfig(obj: object): boolean` — checks `obj._kind === 'ProxyConfig'`.
- `getProtocols(): string[]` — builds a `UrlMatchPattern(this.match)` and returns `.getProtocols()` (parses the `'+'`-delimited protocol prefix of the match string, e.g. `'http+https://...'` → `['http', 'https']`).
- `getProxyUrl(): string` — builds the full proxy URL: `` `${protocol}//${username}:${password}@${host}${port}` `` if `authenticate` is true, otherwise `` `${protocol}//${host}${port}` `` (port segment omitted entirely if `port === undefined`).
- `test(url?: string): boolean` — returns `false` immediately if `url` is falsy (comment: "TODO: it is confusing in which case url arg is optional"). Returns `false` if `url` is literally in `this.bypass` (exact string match, not pattern matching). Otherwise delegates to `new UrlMatchPattern(this.match).test(url)`.
- `update(options: Omit<ProxyConfigOptions, 'bypass' | 'protocol'>): void` — updates `host`, `match`, `port`, `tunnel`, `authenticate`, `username`, `password`. Does **not** allow updating `bypass` or `protocol` (both omitted from the type, and untouched by the method body).
- `updateProtocols(_protocols: string[]): never` — always throws `Error('updateProtocols is not supported in Insomnia')`. Comment: "In Insomnia there is no whitelist while there is a blacklist."

### `class ProxyConfigList<T extends ProxyConfig> extends PropertyList<T>`
- `constructor(parent: PropertyList<T> | undefined, populate: T[])` — constructs the underlying `PropertyList` with `typeClass = ProxyConfig`.
- `static isProxyConfigList(obj: any): boolean` — checks `obj._kind === 'ProxyConfigList'`.
- `resolve(url?: Url): object | null` — returns `null` if `url` is falsy. Otherwise stringifies `url`, filters the list to configs whose `.test(urlStr)` is true, maps matches to `.toJSON()`, and returns the **first** match's JSON (or `null` if none match). Comment: "It only returns the first one if multiple matches are found."
- `override toObject(excludeDisabled?, _caseSensitive?, multiValue?, _sanitizeKeys?): Record<string, any>` — builds a plain object keyed by each config's `match` string, using `Object.create(null)` (no prototype). `excludeDisabled` skips `disabled` configs. `multiValue` collects same-`match` configs into an array; otherwise duplicate `match` values collapse to the last one.

### Module-level function
- `transformToSdkProxyOptions(protocol: string, httpProxy: string, httpsProxy: string, proxyEnabled: boolean, noProxy: string): ProxyConfigOptions` — computes `proxyHost` (the string actually parsed into `host`/`port`/etc. below) as `httpsProxy` or `httpProxy` based on whether `protocol === 'https:'`. But `enabledProxy` is computed separately, from `proxyEnabled && (httpsProxy || httpProxy || '').trim() !== ''` — **not** from `proxyHost` — so it's `true` whenever *either* proxy string is non-empty, regardless of which one the current `protocol` selected (see Gotchas). Splits `noProxy` on commas (trimmed) into the `bypass` list. Always returns `match: '<all_urls>'` (`UrlMatchPattern.MATCH_ALL_URLS`). If the proxy is enabled and a host string is present, parses it with the built-in `URL` class (prefixing `${protocol}//` if the string has no `://`), extracting `port` (only set if non-empty, then `Number.parseInt(..., 10)`), `protocol`, `host` (hostname), `username`, `password`; sets `authenticate = true` if either `username` or `password` came through; logs `` `Using proxy: ${sanitizedProxy}` `` via `getExistingConsole().warn`. Throws `Error('Failed to parse proxy (${protocol}//${proxyHost}): ${e.message}')` if URL parsing fails **and the proxy is enabled** (parsing is skipped entirely, no throw, when the proxy is disabled).

## Script-facing surface
- `pm.request.proxy` is a single `ProxyConfig` instance (per `request.ts`: `const proxy = options.proxy ? new ProxyConfig(options.proxy) : undefined;`), seeded from Insomnia's Settings-level proxy configuration via `transformToSdkProxyOptions` (called in `insomnia.ts`). It is `undefined` if no `proxy` option was supplied when constructing the request.
- Scripts read/write `pm.request.proxy.host`, `.port`, `.username`, `.password`, `.authenticate`, `.tunnel`, `.bypass`, `.protocol` directly, call `.getProxyUrl()` to see the resolved proxy URL, `.test(url)` to check whether a given URL should go through this proxy, and `.update({...})` to change host/match/port/tunnel/authenticate/username/password.
- `ProxyConfigList` and `ProxyConfig` are also exported from the `insomnia-collection` module (via `collection.ts`) so scripts can `require('insomnia-collection')` and construct their own lists directly, e.g.: `new ProxyConfigList(undefined, [{match: 'https://example.com/*', host: 'proxy.com', port: 8080, tunnel: true}, ...])` (per the inline example comment in the source). There is no evidence in the SDK object graph that `pm.request` itself ever holds a `ProxyConfigList` — only a single `ProxyConfig`.

## Gotchas / notable behavior
- **`_index = 'key'` but `ProxyConfig` has no `key` property.** Base `PropertyList.one()`/`.indexOf()`/`.upsert()` look up items by `typeClass._index` (here `'key'`), but `ProxyConfig` instances never define a `key` field — so `ProxyConfigList.one('...')`/`.get('...')`/`.indexOf(...)`/`.upsert(...)` would compare against `undefined` for every item and effectively never index correctly by identity (though `.toObject()` and `.resolve()` work fine since they key/filter explicitly by `match` instead of relying on `_index`).
- **`test(url)` returns `false` silently if `url` is omitted** — the source itself flags this as confusing ("TODO: it is confusing in which case url arg is optional").
- **`bypass` matching is exact string equality**, not pattern-based — a URL must be an exact match to an entry in `bypass` to be excluded; nothing is normalized (no protocol/trailing-slash handling).
- **`update()` cannot change `bypass` or `protocol`** — these are deliberately excluded from `ProxyConfigOptions` in the `update()` signature's `Omit<...>`.
- **`updateProtocols()` always throws** — it exists on the class but is not a supported operation in Insomnia.
- **`getProxyUrl()` omits the port segment entirely when `port === undefined`** (not just falsy — `port: 0` would still render `:0`).
- **`transformToSdkProxyOptions` swallows parse errors when the proxy is disabled**: a malformed proxy host string does not throw as long as `proxyEnabled` is `false`; it only throws when the proxy would actually be used.
- **`enabled`/`disabled` can disagree with the protocol-selected proxy string.** `enabledProxy` is derived from `httpsProxy || httpProxy` (https checked first, regardless of `protocol`), while the proxy actually parsed into `host`/`port`/etc. is `proxyHost` (`httpsProxy` only if `protocol === 'https:'`, else `httpProxy`). If `protocol` is `'http:'` with `httpProxy` empty but `httpsProxy` set (or vice versa), `enabledProxy` comes out `true` from the other, unused string, `proxy.disabled` is set to `false`, yet `proxyHost === ''` skips the parsing block entirely — so `pm.request.proxy` ends up `disabled: false` with an empty `host`.
- **The class-level `static` fields shadow real instance field names** (`static host = ''`, `static match = ''`, etc., separate from `this.host`, `this.match` on instances) — marked `@ignore` and described only as "hidden as they are not used while must be exposed"; do not confuse `ProxyConfig.host` (static, always `''`) with `someProxyConfigInstance.host`.

## Related
- `properties.ts` — `Property` (base class for `ProxyConfig`) and `PropertyList` (base class for `ProxyConfigList`), including the shared `toObject()`/`_index` lookup semantics referenced above.
- `urls.ts` — `UrlMatchPattern`/`UrlMatchPatternList` (used internally by `getProtocols()`/`test()`) and `Url` (the type accepted by `ProxyConfigList.resolve()`).
- `console.ts` — `getExistingConsole()`, used by `transformToSdkProxyOptions` to log which proxy is being used.
- `request.ts` — constructs `pm.request.proxy` from `ProxyConfigOptions` and serializes it back out when building the final request.
- `insomnia.ts` — calls `transformToSdkProxyOptions` using Insomnia Settings (`proxyEnabled`, http/https proxy strings, `noProxy`) to seed the proxy config before a script runs.
- `collection.ts` — re-exports `ProxyConfig`/`ProxyConfigList` for direct use via `require('insomnia-collection')`.
