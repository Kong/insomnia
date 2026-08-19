# Environment / Variables / Vault

**Source:** `packages/insomnia-scripting-environment/src/objects/environments.ts`

## Purpose
This file defines `Environment` (a single flat key-value store), `Variables` (a hierarchical read/write facade over several `Environment` scopes, resolving lookups in precedence order), and `Vault` (a locked-down `Environment` subclass for secrets). `InsomniaObject` (`insomnia.ts`) instantiates these and exposes them as `insomnia.environment`, `insomnia.globals`/`insomnia.baseGlobals` (private), `insomnia.collectionVariables` (aliased to `baseEnvironment`), `insomnia.variables`, and `insomnia.vault` — the core variable model behind pre-request/after-response/test scripts.

## Public API

### `class Environment`
```ts
constructor(name: string, jsonObject: object | undefined)
```
Initializes `_name` and a `Map<string, boolean|number|string|null|undefined>` from `Object.entries(jsonObject || {})`.

- `get name(): string` — returns `_name` (read-only getter; no setter).
- `has = (variableName: string) => boolean` — `Map.has`.
- `get = (variableName: string) => boolean|number|string|null|undefined` — `Map.get`; returns `undefined` if absent.
- `set = (variableName: string, variableValue: boolean|number|string|undefined|null) => void` — sets the value; if `Number.isNaN(variableValue)` is true, logs a warning via `getExistingConsole().warn` and **does not** set the value.
- `unset = (variableName: string) => void` — `Map.delete`.
- `clear = () => void` — `Map.clear`.
- `replaceIn = async (template: string | object) => Promise<string>` — coerces an object template via `.toString()`, throws `TypeError` if not a string/object, then renders it through `getInterpolator().render(template, this.toObject())`. Supports `{{$randomUUID}}` and `{{varName}}` placeholders.
- `toObject = () => Record<string, any>` — `Object.fromEntries(this.kvs.entries())`.
- `toJSON()` — returns `this.toObject()` (drives `JSON.stringify(environment)` serialization).

### `function mergeFolderLevelVars(folderLevelVars: Environment[]): Environment` *(not exported, `@ignore`)*
Reduces an array of folder `Environment`s into one merged `Environment` named `'mergedFolderLevelVars'`, with **later folders in the array winning** on key collisions (`{ ...merged, ...folderLevelEnv.toObject() }`).

### `class Variables`
```ts
constructor(args: {
  baseGlobalVars: Environment;
  globalVars: Environment;
  collectionVars: Environment;
  environmentVars: Environment;
  iterationDataVars: Environment;
  folderLevelVars: Environment[];
  localVars: Environment;
})
```
Stores each scope as a private `Environment` (or `Environment[]` for folder levels).

- `has = (variableName: string) => boolean` — true if any of the 7 scopes has the variable (local, folder-level via `.some`, iterationData, environment, collection, global, baseGlobal — all evaluated eagerly, then OR'd).
- `get = (variableName: string) => value` — builds an ordered array `[localVars, mergeFolderLevelVars(folderLevelVars), iterationDataVars, environmentVars, collectionVars, globalVars, baseGlobalVars]`, uses `.find(vars => vars.has(variableName))` to pick the **first scope (highest precedence) that has the key**, and returns `scope?.get(variableName)`.
- `set = (variableName, variableValue) => void` — **always writes only to `localVars`** (same NaN-guard/warning as `Environment.set`). There is no way to write directly to environment/collection/global scope through `Variables.set`.
- `replaceIn = async (template: string | object) => Promise<string>` — same contract as `Environment.replaceIn`, but the context is `this.toObject()` (the fully merged view across all scopes).
- `toObject = () => Record<string, any>` — maps `[baseGlobalVars, globalVars, collectionVars, environmentVars, iterationDataVars, mergeFolderLevelVars(folderLevelVars), localVars]` to plain objects and folds them left-to-right with `{...ctx, ...obj}`, so **later entries in that array win** — i.e. `localVars` has final say, matching the precedence order used by `get`.
- `localVarsToObject = () => Record<string, any>` *(`@ignore`)* — returns just `localVars.toObject()`; used by `InsomniaObject.toObject()` to serialize `insomnia.variables`.

### `class Vault extends Environment`
```ts
constructor(name: string, jsonObject: object | undefined, enableVaultInScripts: boolean)
```
Calls `super(name, jsonObject)`, then **returns a `Proxy(this, ...)`** (note: the constructor return value, not `this`, is what callers get). The proxy's `get`/`set` traps throw `new Error('Vault is disabled in script')` for **every property/method access** (including inherited `Environment` methods like `get`/`has`) whenever `enableVaultInScripts` is falsy.
- `unset = () => { throw new Error('Vault can not be unset in script'); }` — overridden to always throw, regardless of `enableVaultInScripts`.
- `clear = () => { throw new Error('Vault can not be cleared in script'); }` — always throws.
- `set = () => { throw new Error('Vault can not be set in script'); }` — always throws (vault is read-only from scripts even when enabled).
- Inherited `get`, `has`, `toObject`, `toJSON`, `replaceIn`, `name` still work normally when `enableVaultInScripts` is true (subject to the proxy's guard, which only blocks when the flag is false).

## Script-facing surface
- `insomnia.environment` → an `Environment` instance (the selected sub-environment, or the base environment itself if none is selected — see `initInsomniaObject` in `insomnia.ts`). Scripts call `insomnia.environment.get/set/unset/has/clear/replaceIn/toObject`.
- `insomnia.baseEnvironment` → the collection's base `Environment`.
- `insomnia.collectionVariables` → in `insomnia.ts`, this is literally assigned `this.baseEnvironment` (`this.collectionVariables = this.baseEnvironment;`) — it is not a distinct store, it's the *same* `Environment` object as `insomnia.baseEnvironment`.
- `insomnia.variables` → a `Variables` instance built from all scopes (`insomnia.ts`'s `initInsomniaObject`: `baseGlobalVars: baseGlobals, globalVars: globals, environmentVars: environment, collectionVars: baseEnvironment, iterationDataVars: iterationData, folderLevelVars: parentFolders.getEnvironments(), localVars: localVariables`). Scripts use `insomnia.variables.get/set/has/replaceIn/toObject`. `insomnia.variables.set(...)` only ever affects the transient local scope.
- `insomnia.vault` → a `Vault` instance; `insomnia.vault.get(<name>)` is the documented usage. Gated by the `enableVaultInScripts` setting.
- `insomnia.globals`/`insomnia.baseGlobals` are private fields on `InsomniaObject` (not exposed as public properties), even though they feed into `insomnia.variables`.
- `{{$randomUUID}}`-style and `{{variableName}}` templates in request URLs/bodies/headers are ultimately rendered through `Environment.replaceIn` / `Variables.replaceIn`.

## Gotchas / notable behavior
- **NaN guard**: both `Environment.set` and `Variables.set` silently refuse to store `NaN` and log a console warning instead of throwing — `null` and `undefined` are accepted just fine.
- **Precedence order** (highest to lowest) used consistently by `Variables.has`, `.get`, and `.toObject`: local → folder-level (nearest folder wins) → iteration data → environment → collection (`baseEnvironment`) → global → base global.
- **Falsy values are not skipped**: `Variables.get` uses `.has()` to pick the scope, not truthiness, so a local value of `0`, `''`, or `false` is correctly returned instead of falling through to a lower-precedence scope (verified by a parameterized test in `environments.test.ts`).
- **`collectionVariables` is an alias, not a separate object** — mutating `insomnia.collectionVariables` also mutates `insomnia.baseEnvironment` and vice versa, since they reference the same `Environment` instance.
- **`Variables.set` cannot target non-local scopes** — there is no API on `Variables` to write into environment/collection/global; scripts must use `insomnia.environment.set(...)`, `insomnia.collectionVariables.set(...)`, etc. directly for those scopes.
- **Folder-level merge order**: `mergeFolderLevelVars` merges the given `Environment[]` left-to-right with later entries winning; since `ParentFolders.getEnvironments()` returns folders "from bottom to top" is *not* guaranteed here — actual nearest-wins behavior depends on the order `folderLevelVars` is constructed in by the caller (see `folders.md`).
- **`Vault` returns a `Proxy` from its constructor** — `new Vault(...)` does not yield a plain `Vault` instance; every property access goes through the proxy trap, so `enableVaultInScripts` is (re-)checked on *every* access, not just once at construction.
- **`Vault` is effectively write-protected even when enabled**: `set`, `unset`, and `clear` are all overridden to unconditionally throw, so scripts can only ever read from the vault, never write to it, regardless of the `enableVaultInScripts` flag.
- Deep/nested object values are not directly supported by `Environment`'s type signature (`boolean | number | string | null | undefined`); nothing in this file coerces or validates that at runtime, so anything else the caller passes is stored as-is.

## Related
- `properties.ts` — not used directly here, but `Variables`/`Environment` sit at the same conceptual layer that the `Variable`/`VariableList` classes (in `variables.ts`) also use for interpolation (via `getInterpolator()` in `interpolator.ts`).
- `folders.ts` — `Folder.environment` is an `Environment` instance; `ParentFolders.getEnvironments()` supplies the `folderLevelVars: Environment[]` array consumed by `Variables`.
- `console.ts` — `getExistingConsole()` is used to emit the NaN warning.
- `interpolator.ts` — `getInterpolator().render(...)` implements `{{...}}` template substitution for `replaceIn`.
- `insomnia.ts` — constructs and wires up all the `Environment`/`Variables`/`Vault` instances exposed as `insomnia.environment`, `insomnia.collectionVariables`, `insomnia.baseEnvironment`, `insomnia.variables`, `insomnia.vault`.
