# Cookie, CookieJar, CookieList

**Source:** `packages/insomnia-scripting-environment/src/objects/cookies.ts`

## Purpose
Models HTTP cookies for the scripting environment. `Cookie` wraps a `tough-cookie` cookie plus Insomnia-specific extension fields; `CookieList` is a keyed `PropertyList<Cookie>`; `CookieObject` (a `CookieList` subclass) is the concrete class backing `pm.cookies` and pairs the list with a `CookieJar`; `CookieJar` is a custom (non-tough-cookie) jar keyed by domain used for `pm.cookies.jar()`. `mergeCookieJar` reconciles a script-produced jar back into Insomnia's native `CookieJar` model.

## Public API

### Types
- `interface InsomniaCookieExtensions { creation?: Date; creationIndex?: number; lastAccessed?: Date; pathIsDefault?: boolean }` — Insomnia-only metadata carried alongside the standard cookie fields.
- `interface CookieOptions extends InsomniaCookieExtensions { id?: string; key: string; value: string; expires?: Date | string | null; maxAge?: number | 'Infinity' | '-Infinity'; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; hostOnly?: boolean; session?: boolean; extensions?: { key: string; value: string }[] }` — constructor input for `Cookie`.

### `class Cookie extends Property`
- `constructor(cookieDef: CookieOptions | string)` — if given a string, parses it via `Cookie.parse()` first (throws `Error('failed to parse cookie, the cookie string seems invalid')` if parsing fails or the tough-cookie construction fails). Wraps the result in a `tough-cookie` `Cookie` (`ToughCookie.fromJSON`). `extensions` are stored separately from the tough-cookie object (tough-cookie only handles `string[]` extensions natively).
- `static override _index = 'key'` — `PropertyList.one()`/`indexOf()` look items up by `key` for cookie lists.
- `static isCookie(obj: Property): boolean` — checks `obj._kind === 'Cookie'`.
- `static parse(cookieStr: string): CookieOptions` — parses a `Set-Cookie`-style string (loose mode) via tough-cookie, pulls `HostOnly`/`Session` out of the extensions list into dedicated booleans, and converts remaining string extensions (`key=value` or bare flags, which become `{key, value: 'true'}`) into `{key, value}` objects. Throws if the string can't be parsed by tough-cookie.
- `static stringify(cookie: Cookie): string` — alias for `cookie.toString()`.
- `static unparseSingle(cookieOpt: CookieOptions): string` — constructs a `Cookie` from options and returns its string form.
- `static unparse(cookies: Cookie[]): string` — joins each cookie's `toString()` with `'; '`.
- `toString(): string` — tough-cookie's own `toString()` plus `; HostOnly`, `; Session`, and `; key=value` segments appended for any extensions/inso flags present.
- `valueOf(): string` — returns just `cookie.value` (used by `PropertyList.one()` for lookups and by `toObject()`).
- `get key(): string` — reads through to `this.cookie.toJSON().key`.
- `toJSON()` — returns the full plain-object shape: `{ id, key, value, expires, maxAge, domain, path, secure, httpOnly, hostOnly, session, extensions, creation, creationIndex, lastAccessed, pathIsDefault }`. Note `expires` is coerced to `undefined` when tough-cookie reports `'Infinity'`.

### `class CookieList extends PropertyList<Cookie>`
- `constructor(cookies: Cookie[])` — always constructs with `typeClass = Cookie`, no `parent`.
- `static isCookieList(obj: object): boolean`.
- `override toObject(excludeDisabled?, _caseSensitive?, multiValue?, _sanitizeKeys?): Record<string, string | string[]>` — builds a plain `key -> value` map via `Object.create(null)` (so no prototype — dangerous keys like `__proto__`/`constructor` land as own properties, not pollute the prototype). `excludeDisabled` skips cookies where `cookie.disabled` is true. `multiValue` collects same-key cookies into an array instead of overwriting (last value wins when `multiValue` is falsy).

### `class CookieObject extends CookieList`
This is the concrete class instantiated as `pm.cookies`.
- `constructor(cookieJar: InsomniaCookieJar | null)` — maps each native Insomnia cookie into a script `Cookie` (translating numeric `expires` into a `Date`, and passing through `maxAge: undefined`/`session: undefined`/`extensions: undefined` since those fields aren't tracked by Insomnia's native cookie model). Also builds an internal `CookieJar` (named from `cookieJar.name`, or `''`/empty if `cookieJar` is `null`).
- `jar(): CookieJar` — returns the internal `CookieJar` instance backing `pm.cookies.jar()`.

### `class CookieJar` (custom, not `tough-cookie`'s jar)
Comment: "CookieJar from tough-cookie can not be used, as it will fail in comparing context location and cookies' domain as it reads location from the browser window, it is 'localhost'". Internally a `Map<domain, Map<cookieKey, Cookie>>`.
- `constructor(jarName: string, cookies?: Cookie[])` — indexes each cookie by its `domain` (read via `cookie.toJSON().domain`). If a cookie has no `domain`, it's **dropped** with a console warning: `` `domain is not specified for the cookie "${cookie.key}" so it is omitted` `` (via `getExistingConsole().warn`).
- `set(url: string, key: string, value: string | CookieOptions, cb: (error?: Error, cookie?: Cookie) => void): void` — `url` is actually used as the domain key (not parsed as a URL). If `value` is a plain string, constructs a minimal `Cookie({ key, value, domain: url })`; otherwise treats `value` as full `CookieOptions` and constructs `new Cookie(value)`. Always calls `cb(undefined, cookie)` — this implementation never produces an error.
- `get(url: string, name: string, cb: (error?: Error, cookie?: Cookie) => void): void` — looks up `name` within the `url` domain bucket; calls back with `undefined` cookie if not found (not an error).
- `getAll(url: string, cb: (error?: Error, cookies?: Cookie[]) => void): void` — returns all cookies for that domain bucket (empty array if none).
- `unset(url: string, name: string, cb: (error?: Error | null) => void): void` — deletes `name` from the domain bucket if the bucket exists; always calls back with no error.
- `clear(url: string, cb: (error?: Error | null) => void): void` — deletes the entire domain bucket.
- `toInsomniaCookieJar(): { name: string; cookies: Partial<InsomniaCookie>[] }` — flattens the map back into Insomnia's native cookie-jar shape. `expires` is defaulted back to `'Infinity'` if falsy ("avoid edge cases").

### Module-level function
- `mergeCookieJar(originalCookieJar: InsomniaCookieJar, updatedCookieJar: { name: string; cookies: Partial<InsomniaCookie>[] }): InsomniaCookieJar` — assigns a fresh `uuidv4()` id to any cookie missing one (mirroring the id-generation approach in Insomnia's `cookie-list.tsx`), and returns `{ ...originalCookieJar, cookies: cookiesWithId }`. This is the function that reconciles a script's mutated jar back into Insomnia's persisted model after a script runs.

## Script-facing surface
- `pm.cookies` is a `CookieObject` (constructed in `insomnia.ts` via `new CookieObject(rawObj.cookieJar)`), so scripts get all `CookieList`/`PropertyList` methods directly: `pm.cookies.get(key)` / `pm.cookies.one(key)` (via inherited `PropertyList.get`/`one`, which for `Cookie` returns `cookie.valueOf()` — i.e. just the string value, not the `Cookie` object, because `Cookie.valueOf` is defined), `pm.cookies.toObject()`, `pm.cookies.all()`, `pm.cookies.count()`, `pm.cookies.each()`, `pm.cookies.add()`, etc.
- `pm.cookies.jar()` returns the `CookieJar`, giving access to `set(url, key, value, cb)`, `get(url, name, cb)`, `getAll(url, cb)`, `unset(url, name, cb)`, `clear(url, cb)` — all Postman-style callback-based cookie-jar operations, scoped by domain (the `url` argument is treated as a plain domain string, not parsed).
- After a script runs, Insomnia calls `this.cookies.jar().toInsomniaCookieJar()` (see `insomnia.ts`) to get the jar back out, which is then merged via `mergeCookieJar`.

## Gotchas / notable behavior
- **`PropertyList.one()`/`.get()` return the raw value, not a `Cookie`**: because `Cookie` defines `valueOf()`, and `PropertyList.one()` special-cases items with a `valueOf` method — `pm.cookies.get('foo')` returns the cookie's string value, not the `Cookie` instance. To get the full object, use `pm.cookies.find(...)` or `pm.cookies.all()` instead.
- **`toObject()` uses `Object.create(null)`** specifically to avoid prototype pollution when cookie keys are things like `__proto__` or `constructor` — confirmed by a dedicated test (`toObject does not pollute the prototype for dangerous cookie keys`).
- **Cookies without a `domain` are silently dropped** when building a `CookieJar` (constructor only; a warning is logged, not thrown).
- **`maxAge` and `session` are not persisted from Insomnia's native model**: `CookieObject`'s constructor always sets `maxAge: undefined` and `session: undefined` when converting from `InsomniaCookieJar`, with inline comments "not supported in Insomnia".
- **`extensions` format from Insomnia is unknown** per an inline `TODO` — `CookieObject`'s constructor always passes `extensions: undefined`.
- **`CookieJar.set()` never reports an error** — the callback signature allows an `Error`, but the implementation has no failure path (a malformed `CookieOptions` would throw inside `new Cookie(...)` before the callback is ever reached, rather than being passed to `cb`).
- **Duplicate keys in `toObject()` collapse to the last value** unless `multiValue` is passed as `true`, in which case duplicates accumulate into an array.
- **`Cookie.parse()` of a malformed string like `'=gingerale'`** still succeeds with `key: ''`, `value: 'gingerale'`, `expires: 'Infinity'` (per the test) — it does not throw for merely unusual input, only for input tough-cookie's parser rejects entirely.

## Related
- `properties.ts` — `Property` (base class for `Cookie`) and `PropertyList` (base class for `CookieList`).
- `console.ts` — `getExistingConsole()`, used by `CookieJar`'s constructor to warn about domain-less cookies.
- `insomnia.ts` — constructs `pm.cookies` as `new CookieObject(rawObj.cookieJar)` and reads back `this.cookies.jar().toInsomniaCookieJar()` after script execution.
- `insomnia-data` package — source of the native `Cookie`/`CookieJar` types this file converts to/from.
- `tough-cookie` (external) — underlying cookie parse/stringify implementation wrapped by `Cookie`.
