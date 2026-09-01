# Variable / VariableList

**Source:** `packages/insomnia-scripting-environment/src/objects/variables.ts`

## Purpose
This file defines the low-level key/value model — `Variable` (a single named, typed value) and `VariableList` (an ordered, keyed collection of `Variable`s) — built on top of `Property`/`PropertyList` from `properties.ts`. Unlike `Environment` (a `Map`-backed flat store used for `pm.environment`/`pm.globals`), `Variable`/`VariableList` is the object-per-entry model used elsewhere in the SDK wherever a Postman-compatible "list of variable-shaped items" is needed (e.g. request path parameters); it is not the type behind `insomnia.environment` or `insomnia.variables`.

## Public API

### `interface VariableDefinition`
```ts
interface VariableDefinition {
  id?: string;
  key: string;
  name?: string;
  value: string;
  type?: string;
  disabled?: boolean;
}
```
Shape used to construct a `Variable`.

### `class Variable extends Property`
```ts
constructor(def?: VariableDefinition)
```
Calls `super()` (no args passed to `Property`'s constructor, so `Property`'s own `id`/`name`/`disabled` defaults are set first, then overwritten below). When `def` is provided: `id = def.id || ''`, `key = def.key`, `name = def.name`, `value = def.value`, `type = def.type || 'Variable'`, `disabled = def.disabled`. When `def` is omitted: `id = ''`, `key = ''`, `name = undefined`, `value = ''`, `type = 'Variable'`, `disabled = false`.

- `key: string` — the variable's lookup key.
- `value: any` — the stored value (any type, despite `VariableDefinition.value` being typed `string`).
- `type: string` — defaults to `'Variable'`.
- `override _kind = 'Variable'` *(`@ignore`)*.
- `static override _index = 'key'` *(`@ignore`)* — tells `PropertyList`/`indexOf`/`one` to index `Variable`s by `key` instead of the default `id`.
- `static types()` — **throws** `unsupportedError('types')` unconditionally; not implemented.
- `cast(value: any)` — if `value` has `_kind === 'Variable'`, returns `value.value` (unwraps a `Variable` to its raw value); otherwise returns `undefined`.
- `get()` — returns `this.value`.
- `set(value: any)` — sets `this.value = value`.

### `class VariableList<T extends Variable> extends PropertyList<T>`
```ts
constructor(parent: PropertyList<T> | undefined, populate: T[])
```
Calls `super(Variable, undefined, populate)` (always uses `Variable` as `typeClass`, ignoring `T`'s actual class for indexing purposes), then sets `this.parent = parent`.

- `override _kind = 'VariableList'` *(`@ignore`)*.
- `static isVariableList(obj: any): boolean` — `'_kind' in obj && obj._kind === 'VariableList'`.
- `override toObject(excludeDisabled?: boolean, _caseSensitive?: boolean, multiValue?: boolean, _sanitizeKeys?: boolean): Record<string, any>` — builds a plain object keyed by each `Variable.key`:
  - skips entries where `excludeDisabled && variable.disabled`.
  - if `multiValue` is true and the key already exists in the output, coalesces values into an array (`[existing, value]`, growing it on further duplicates).
  - otherwise, later entries with the same key overwrite earlier ones (last-write-wins) when `multiValue` is falsy.
  - `_caseSensitive` and `_sanitizeKeys` are accepted for signature compatibility but unused.

All other list operations (`add`, `all`, `append`, `assimilate`, `clear`, `count`, `each`, `filter`, `find`, `get`, `has`, `idx`, `indexOf`, `insert`, `insertAfter`, `map`, `one`, `populate`, `prepend`, `reduce`, `remove`, `repopulate`, `toString`, `upsert`) are inherited unmodified from `PropertyList` — see `properties.md`. Because `Variable._index = 'key'`, `indexOf`/`one`/`upsert`/`has` on a `VariableList` match by `key`, not `id`.

## Script-facing surface
Not directly exposed as `pm.*`/`insomnia.*` on its own — `insomnia.environment` and `insomnia.variables` are backed by `Environment`/`Variables` (see `environments.md`), not by `Variable`/`VariableList`. `Variable`/`VariableList` are the generic building blocks other collection-shaped properties reuse (e.g. anywhere the SDK needs an ordered, keyed set of `{key, value}` items with Postman-style list semantics such as `.upsert()`/`.toObject()`). Exported from the package's public surface via `index.ts` (`export { Variable, VariableList } from './variables'`) and re-exported under the `Collection` namespace via `collection.ts`, so consumers of the SDK's type declarations can reference `Collection.Variable`/`Collection.VariableList`.

## Gotchas / notable behavior
- `Variable.types()` is a stub that always throws `unsupportedError('types')` — calling it will break a script; it exists only for API-shape completeness.
- `Variable.cast(value)` assumes `value` is an object with `in` support (`'_kind' in value`) — passing a primitive (e.g. `cast(5)`) will throw a `TypeError` since `in` requires an object operand on the right-hand side. There's no type guard before that check.
- `VariableList`'s constructor hardcodes `Variable` as the `typeClass` regardless of the generic `T`, so subclasses of `Variable` (if any) still get indexed as plain `Variable` for `_index` purposes.
- `VariableList.toObject()` **includes disabled variables by default** — callers must explicitly pass `excludeDisabled = true` to filter them out (confirmed by `variables.test.ts`: `toObject()` returns `{h1: 'v1', h2: 'v2'}` even when `h2` is disabled).
- Duplicate keys: `toObject()` silently drops earlier duplicates unless `multiValue` is passed, in which case duplicates become an array under a single key — this can be surprising if a script assumes object-key uniqueness maps 1:1 to list length.

## Related
- `properties.ts` — `Variable extends Property`, `VariableList extends PropertyList<T>`; inherits nearly all list/property behavior from there.
- `environments.ts` — conceptually parallel/alternate model (`Environment`/`Variables`) that is what `insomnia.environment`/`insomnia.variables`/`insomnia.collectionVariables` actually use; do not confuse the two when debugging variable-resolution issues.
- `index.ts` / `collection.ts` — re-export `Variable`/`VariableList` as part of the SDK's public/namespaced surface.
