# Header, HeaderList

**Source:** `packages/insomnia-scripting-environment/src/objects/headers.ts`

## Purpose

Models a single HTTP header (`Header`) and an ordered collection of headers (`HeaderList`). Used by `Request.headers` and `Response.headers` (`pm.request.headers` / `pm.response.headers`), and internally by `Request`'s header-merge logic. `HeaderList` is a thin specialization of the generic `PropertyList`.

## Public API

### `HeaderDefinition` (interface)
`{ key: string; value: string; id?: string; name?: string; disabled?: boolean }`

### `Header` (extends `Property`)
- `override _kind = 'Header'`
- `key: string`, `value: string`
- `constructor(opts: HeaderDefinition | string, name?: string)` — if `opts` is a string, it's parsed via `Header.parseSingle` (only `key`/`value` are set — `id`/`name`/`disabled` come from `Property`'s defaults, not from the string). If `opts` is an object, `id`, `key`, `name` (overridden by the `name` param if given), `value`, and `disabled` are all read from it (each falling back to `''`/`false` if absent).
- `static override _index = 'key'` — tells `PropertyList` to index/dedupe `Header`s by `key` (used by `one`, `indexOf`, `upsert`).
- `static create(input?: {key, value} | string, name?: string): Header` — defaults `input` to `{key: '', value: ''}`.
- `static isHeader(obj: object): boolean` — checks `_kind === 'Header'`.
- `static parse(headerString: string): {key, value}[]` — splits on `\n`, ignores blank lines, parses each via `parseSingle`.
- `static parseSingle(headerStr: string): {key, value}` — splits on the **first** colon. **Throws** `Error('Header.parseSingle: the header string seems invalid')` if there's no colon or it's at position 0.
- `static unparse(headers: {key,value}[] | PropertyList<Header>, separator?: string): string` — maps each header through `unparseSingle` and joins (default separator `'\n'`).
- `static unparseSingle(header: {key,value} | Header): string` — `"key: value"`.
- `update(newHeader: {key, value})` — mutates `this.key`/`this.value` in place.
- `override valueOf()` — returns `this.value`.

### `HeaderList<T extends Header>` (extends `PropertyList<T>`)
- `constructor(parent: PropertyList<T> | undefined, populate: T[])` — internally always constructs the underlying `PropertyList` with `Header` as the type class (regardless of `T`).
- `static isHeaderList(obj: any): boolean` — checks `_kind === 'HeaderList'`.
- `contentSize(): number` — sum of `header.toString().length` (i.e. `"key: value"`.length) across all headers; comment notes special characters aren't handled.
- `override toObject(excludeDisabled?: boolean, _caseSensitive?: boolean, multiValue?: boolean, _sanitizeKeys?: boolean): Record<string, string | string[]>` — builds a plain key→value(s) map. `excludeDisabled` (default falsy) skips headers with `disabled` truthy. `multiValue` (default falsy) collects same-key headers into an array instead of overwriting with the last value. `_caseSensitive` and `_sanitizeKeys` are accepted but **unused**.

## Script-facing surface

`pm.request.headers` and `pm.response.headers` are `HeaderList<Header>` instances. Beyond the methods above, all generic `PropertyList` methods are available: `add`/`append`, `all()`, `assimilate()`, `clear()`, `count()`, `each()`, `filter()`, `find()`, `get(key)` / `one(key)` (keyed by `key` since `Header._index = 'key'`), `has()`, `idx()`, `indexOf()`, `insert()`/`insertAfter()`, `map()`, `populate()`, `prepend()`, `reduce()`, `remove()`, `repopulate()`, `toString()`, `upsert()`. Typical script usage: `pm.request.headers.add({key, value})`, `pm.request.headers.get('Content-Type')`, `pm.response.headers.has(...)`, `pm.request.headers.upsert(new Header({...}))`.

## Gotchas / notable behavior

- `new Header(stringOpts)` only populates `key`/`value` from the parsed string — `id`, `name`, and `disabled` are left at `Property`'s constructor defaults (`''`, `''`, `false`), never read from the string form.
- `Header.parseSingle` throws on malformed input (no colon) — a raw header string with a typo can throw instead of silently producing an empty/garbage header.
- `PropertyList.one(key)` (inherited, used for `HeaderList.get`) iterates **from the end of the list backwards**, so when duplicate keys exist, the **last-added** matching header wins — relevant when a script both sets a default header and later overrides it with the same key.
- `HeaderList.toObject()`'s `_caseSensitive` and `_sanitizeKeys` parameters exist in the signature (for compatibility with Postman's original API shape) but have **no effect** — only `excludeDisabled` and `multiValue` are actually implemented.
- `HeaderList`'s constructor ignores its own `T` type parameter internally — it always builds the base `PropertyList` using the concrete `Header` class, not whatever `T` was passed.

## Related

- `packages/insomnia-scripting-environment/src/objects/properties.ts` — `Property` (base class for `Header`), `PropertyList` (base class for `HeaderList`).
- `packages/insomnia-scripting-environment/src/objects/request.ts` — `Request.headers: HeaderList<Header>`; also reuses `Header`/`HeaderList` in `addHeader`/`removeHeader`/`upsertHeader`/`getHeaders`.
- `packages/insomnia-scripting-environment/src/objects/response.ts` — `Response.headers: HeaderList<Header>`; used in `contentInfo()` to find `Content-Type`/`Content-Disposition`.
