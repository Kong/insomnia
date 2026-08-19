# PropertyBase / Property / PropertyList

**Source:** `packages/insomnia-scripting-environment/src/objects/properties.ts`

## Purpose
Base classes that most other SDK objects extend, mirroring Postman's `postman-collection` `Property`/`PropertyList` model: `PropertyBase` provides parent-chain traversal and JSON serialization, `Property` adds `id`/`name`/`disabled` plus static template-substitution helpers, and `PropertyList<T>` is a generic ordered/keyed collection with Postman-compatible methods (`add`, `each`, `filter`, `find`, `one`, `upsert`, `toObject`, etc.). Concrete subclasses (`Variable`/`VariableList`, `Header`/`HeaderList`, `Cookie`/`CookieList`, `ProxyConfig`/`ProxyConfigList`, etc.) build on top of these.

## Public API

### `unsupportedError(featureName: string, alternative?: string): Error`
Builds an `Error` with message `` `${featureName} is not supported yet` `` (optionally appending `, please use ${alternative} instead temporarily.` when `alternative` is given). Used throughout the SDK (e.g. `Variable.types()`, `PropertyList.eachParent`) to mark stubbed-out Postman-compat methods.

### `class PropertyBase`
```ts
constructor(description?: string)
```
- `public _kind = 'PropertyBase'` — used as a lightweight runtime type tag (checked via `'_kind' in obj` elsewhere, e.g. `VariableList.isVariableList`).
- `protected _parent: PropertyBase | undefined` — set only via subclasses/external assignment; no setter method is provided on the base class itself.
- `protected description?: string`.
- `static propertyIsMeta(_value: any, key: string): boolean` — `key && key.startsWith('_')` (keys starting with `_` are treated as "meta").
- `static propertyUnprefixMeta(_value: any, key: string): string` — strips a leading `_` from `key` if present.
- `meta(): {}` — always returns an empty object (not implemented beyond the stub).
- `parent(): PropertyBase | undefined` — returns `this._parent`.
- `forEachParent(_options: { withRoot?: boolean }, iterator: (obj: PropertyBase) => boolean): PropertyBase[] | undefined` — BFS-style walk up the parent chain (via `parent()`), cloning each ancestor with the `clone` package before passing it to `iterator`; stops as soon as `iterator` returns falsy, and always returns the array of cloned ancestors visited so far (or `undefined` if there is no parent at all). `_options` is accepted but never read.
- `findInParents(property: string, customizer?: (ancestor: PropertyBase) => boolean): PropertyBase | undefined` — walks the (cloned) parent chain looking for the first ancestor whose `meta()` keys include `property`; if `customizer` is given, keeps walking until `customizer(ancestor)` returns truthy, otherwise returns the first ancestor with that meta key. Returns `undefined` if no parent, or none matches.
- `toJSON(): Record<string, any>` — returns `Object.entries(this)` filtered to drop function-valued entries, `undefined` values, and the `_kind` key.
- `toObject(): Record<string, any>` — returns `this.toJSON()`.
- `toString(): string` — `JSON.stringify(this.toJSON())`.

### `class Property extends PropertyBase`
```ts
constructor(id?: string, name?: string, disabled?: boolean, info?: { id?: string; name?: string })
```
`info.id`/`info.name` take priority over the positional `id`/`name` params if both are given; `this._kind` is set to `'Property'`; `disabled` defaults to `false`.
- `id: string`, `name?: string`, `disabled?: boolean`.
- `static _index = 'id'` — the field name `PropertyList` uses to key/index items of this type; overridden by subclasses (e.g. `Variable._index = 'key'`).
- `static async replaceSubstitutions(content: string, ...variables: object[]): Promise<string>` — throws `TypeError` if `variables` isn't an array or `content` isn't a string. Merges `variables` into a single context object: the array is `.reverse()`d first, then folded left-to-right with `{...context, ...variable}`, so the reversed (originally-last) entries are applied first and get overwritten by earlier ones — net effect: **the leftmost/first argument passed to `replaceSubstitutions` wins** on key collisions, matching the inline comment ("the searching priority of rendering is from left to right"). Renders `content` against that merged context via `getInterpolator().render(...)`.
- `static async replaceSubstitutionsIn(obj: object, ...variables: object[]): Promise<object>` — same signature/merge semantics as `replaceSubstitutions`, but stringifies `obj` with `JSON.stringify`, renders it, then `JSON.parse`s the result. Throws `TypeError` for bad args up front; wraps any other error (e.g. a `JSON.parse` failure on non-JSON-safe rendered output) in a new `Error('replaceSubstitutionsIn: ' + e.toString())`.
- `describe(content: string, typeName: string): void` — sets `this._kind = typeName` and `this.description = content`.

### `class PropertyList<T extends Property>`
```ts
constructor(
  protected typeClass: { _index?: string },
  protected parent: Property | PropertyList<any> | undefined,
  populate: T[],
)
```
- `protected _kind = 'PropertyList'`, `protected list: T[]`.
- `static isPropertyList(obj: object): boolean` — `'_kind' in obj && obj._kind === 'PropertyList'`.
- `add(item: T): void` — pushes to the end of `list`.
- `all(): Record<string, any>[]` — `list.map(pp => pp.toJSON())`.
- `append(item: T): void` — alias for `add`.
- `assimilate(source: T[] | PropertyList<T>, prune?: boolean): void` — if `prune`, calls `clear()` first; then pushes all of `source`'s items (`source.list` if it's a `PropertyList`, else the array itself) onto `list`. Per an inline comment, "it doesn't update values from a source list" (i.e. this appends, it does not merge/replace by key).
- `clear(): void` — `list = []`.
- `count(): number` — `list.length`.
- `each(iterator: (item: T) => void, context: object): void` — calls `list.forEach(iterator)`; `context` is stashed as `iterator.context` (assigned onto the function) but the iterator itself is not invoked with that context bound — purely a Postman-compat artifact.
- `eachParent(_iterator, _context?): never` — **always throws** `unsupportedError('eachParent')`; not implemented ("properties are not organized as hierarchy" per the TODO comment).
- `filter(rule: (item: T) => boolean, context: object): T[]` — same `context`-stash pattern as `each`; returns `list.filter(rule)`.
- `find(rule: (item: T) => boolean, context?: object): T | undefined` — same pattern; `list.find(rule)`.
- `get(key: string): T | undefined` — alias for `one(key)`.
- `has(item: T, _value?: any): boolean` — `indexOf(item) >= 0`; `_value` is accepted but unused ("its usage is unknown" per comment).
- `idx(index: number): T | undefined` — returns `list[index]` if `index <= list.length - 1`, else `undefined`.
- `indexOf(item: string | T): number` — looks up the index field via `typeClass._index || 'id'`; if `item` is a string, matches `record[indexFieldName] === item`; otherwise matches `record[indexFieldName] === (item as Record<string, any>)[indexFieldName]`. Returns `-1` if not found.
- `insert(item: T, before?: number): void` — splices `item` in before index `before` if valid (`before != null && before >= 0 && before <= list.length - 1`), else falls back to `append(item)`.
- `insertAfter(item: T, after?: number): void` — splices `item` in right after index `after` under the same bounds check, else falls back to `append(item)`.
- `map(iterator: (item: T) => any, context: object): any[]` — same `context`-stash pattern; `list.map(iterator)`.
- `one(id: string): T | undefined` — scans `list` **backwards** (`for (let i = list.length - 1; i >= 0; i--)`) for the first record whose index field equals `id`; if the matched item has a callable `valueOf`, returns `item.valueOf()` instead of the item itself; else returns the item as-is. Returns `undefined` if not found.
- `populate(items: T[]): void` — `list = [...list, ...items]`.
- `prepend(item: T): void` — `list = [item, ...list]`.
- `reduce(iterator: (acc: any, item: T) => any, accumulator: any, context: object): any` — same `context`-stash pattern; `list.reduce(iterator, accumulator)`.
- `remove(predicate: T | ((item: T) => boolean), context: object): void` — if `predicate` is a function, keeps everything that does *not* match it (via `filter` with the negated predicate); if `predicate` is a value, keeps everything not `deep-equal` to it.
- `repopulate(items: T[]): void` — `clear()` then `populate(items)`.
- `toObject(_excludeDisabled?, _caseSensitive?, _multiValue?, _sanitizeKeys?): Record<string, any> | Record<string, any>[]` — base implementation ignores all four arguments and returns `list.map(elem => elem.toJSON())` (an array, not a keyed object) — it's the fallback for lists whose items have no natural key (e.g. `UrlMatchPatternList`, or a raw `PropertyList` not used through a subclass). Subclasses backed by keyed items (`CookieList`, `HeaderList`, `VariableList`, `ProxyConfigList`) override this with a real key→value map that supports `excludeDisabled`/`multiValue`; `caseSensitive`/`sanitizeKeys` remain unsupported even in those overrides.
- `toString(): string` — `` `[${list.map(item => item.toString()).join('; ')}]` ``.
- `upsert(item: T): boolean` — returns `false` immediately if `item == null`. If `indexOf(item)` finds an existing entry, **splices it out and reinserts the new item at the same position** (returns `false`, meaning "updated, not inserted"); otherwise calls `add(item)` and returns `true` ("inserted new"). Note: the "splice out, then splice again" implementation calls `this.list.splice(...)` twice on the *same* array reference inside one expression (`[...this.list.splice(0, itemIdx), item, ...this.list.splice(itemIdx + 1)]`) — the first `splice` call mutates `this.list` in place before the second one runs against the now-shortened array.

## Script-facing surface
Not directly exposed as `pm.*`/`insomnia.*` itself — these are base classes. Scripts interact with them only through concrete subclasses' public APIs, e.g.:
- `pm.variables`/collections of variables → `VariableList` (extends `PropertyList<Variable>`), `Variable` (extends `Property`) — see `variables.md`.
- `pm.request.headers`, `pm.response.headers` → `HeaderList`/`Header`.
- `pm.request.url.query` → `UrlMatchPatternList`/similar list types.
- Any script calling `.get()`, `.one()`, `.each()`, `.filter()`, `.upsert()`, `.toObject()`, etc. on a collection-like SDK object is going through `PropertyList`'s implementation documented above.
- `Property.replaceSubstitutions`/`replaceSubstitutionsIn` back the SDK's `{{variable}}` template rendering wherever it's invoked as a static helper (distinct from, but functionally similar to, `Environment.replaceIn`/`Variables.replaceIn` in `environments.ts`).

- **`replaceSubstitutions`/`replaceSubstitutionsIn` mutate their own `variables` rest-array via `.reverse()`** before merging — this is an implementation detail (not observable to callers since `variables` is a fresh rest-parameter array each call), but worth knowing if you're stepping through this code: the reversal is what makes the final left-to-right merge produce "leftmost argument wins" precedence.
- **`eachParent` always throws** `unsupportedError('eachParent')` — calling it from a script will break, regardless of arguments.
- **`each`/`filter`/`find`/`map`/`reduce`'s `context` parameter does nothing functionally** — it's stashed as a property on the callback function object (`it.context = context`) purely for Postman API-shape compatibility, but the callback is invoked with `Array.prototype`'s normal (unbound) semantics, so relying on `context` for `this`-binding inside the iterator will not work as it might in Postman.
- **`one(id)` scans backwards and unwraps `valueOf()`** — if two items share the same index-field value, `one()` returns the *last*-added one (matching most recently `add`/`upsert`ed semantics), and if that item defines a custom `valueOf`, the returned object is `item.valueOf()`, not the raw list item.
- **`upsert` mutates in place via double `splice`** — functionally correct (replace at the same index) but relies on `Array.prototype.splice`'s in-place mutation being sequenced correctly across the two calls inside one array-literal expression; worth knowing if extending/refactoring this method.
- **`toObject()`'s base implementation returns an array, not an object**, unlike its keyed subclass overrides (`VariableList.toObject()` etc., which return `Record<string, any>`) — code that assumes every `PropertyList.toObject()` yields a key/value map will break for list types that don't override it (e.g. `UrlMatchPatternList`).
- `PropertyBase.forEachParent`/`findInParents` both `clone()` each ancestor before handing it to the caller/comparing — mutations the iterator/customizer performs on the passed-in ancestor object do not affect the real parent chain.
- `Property`'s constructor lets `info.id`/`info.name` silently override the positional `id`/`name` arguments — passing both can be surprising if not intentional.

## Related
- `variables.ts` — `Variable extends Property`, `VariableList extends PropertyList<T>` (see `variables.md`).
- `environments.ts` — a separate, non-`Property`-based variable model (`Environment`/`Variables`) used for `insomnia.environment`/`insomnia.variables`/`insomnia.collectionVariables`; don't conflate the two when tracing a variable bug.
- `interpolator.ts` — `getInterpolator().render(...)` is what `Property.replaceSubstitutions`/`replaceSubstitutionsIn` delegate to for `{{...}}` template rendering.
- `headers.ts`, `cookies.ts`, `proxy-configs.ts`, `urls.ts` — other concrete `Property`/`PropertyList` subclasses that override `toObject()` with their own keyed semantics.
- `collection.ts` / `index.ts` — re-export `Property`, `PropertyBase`, `PropertyList` as part of the SDK's public surface.
