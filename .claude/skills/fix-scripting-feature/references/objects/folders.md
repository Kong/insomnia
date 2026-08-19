# Folder / ParentFolders

**Source:** `packages/insomnia-scripting-environment/src/objects/folders.ts`

## Purpose
Models the folder hierarchy a request lives in, each folder carrying its own folder-level `Environment` of variables. `ParentFolders` is a container/lookup helper over an ordered array of `Folder`s, and its `getEnvironments()` is what feeds the `folderLevelVars: Environment[]` array consumed by `Variables` (`environments.ts`) — i.e. this is the source of folder-scoped variable resolution for `insomnia.variables`.

## Public API

### `class Folder`
```ts
constructor(id: string, name: string, environmentObject: object | undefined)
```
- `id: string`
- `name: string`
- `environment: Environment` — constructed as `new Environment(`${id}.environment`, environmentObject)` (see `environments.md`).
- `toObject = () => { id: string; name: string; environment: Record<string, any> }` — returns `id`, `name`, and `environment.toObject()`.

### `class ParentFolders`
```ts
constructor(private folders: Folder[])
```
Per the constructor JSDoc, `folders` is expected "from bottom to top" (nearest-ancestor folder first).

- `get = (idOrName: string) => Folder` — finds the first folder whose `name` or `id` matches; **throws** `Error('Folder "<idOrName>" not found')` if none match.
- `getById = (id: string) => Folder` — finds by `id` only; throws the same style of error if not found.
- `getByName = (folderName: string) => Folder` — finds by `name` only; throws the same style of error if not found.
- `findValue = (valueKey: string) => value | undefined` — reverses a **copy** of `this.folders` (`[...this.folders].reverse()`) and returns the first folder (after reversal) whose `environment.has(valueKey)`, then returns that folder's `environment.get(valueKey)`; returns `undefined` if no folder has it.
- `toObject = () => object[]` — maps every folder to `folder.toObject()`, preserving the original (non-reversed) array order.
- `getEnvironments = () => Environment[]` — maps every folder to `folder.environment`, preserving the original array order. This is the array handed to `Variables({ folderLevelVars: ... })`.

## Script-facing surface
Not directly exposed as a `pm.*` object itself — `ParentFolders` is internal plumbing constructed in `insomnia.ts`'s `initInsomniaObject`:
```ts
const parentFolders = new ParentFolders(
  rawObj.parentFolders.map(folderObj => new Folder(folderObj.id, folderObj.name, folderObj.environment)),
);
```
and consumed two ways:
- `parentFolders.getEnvironments()` → passed as `folderLevelVars` into `insomnia.variables` (`Variables`), so scripts reading `insomnia.variables.get('someFolderVar')` are indirectly reading through `Folder.environment`.
- `parentFolders.toObject()` → included in `InsomniaObject.toObject()`'s `parentFolders` field (used for serialization/debugging, not typically read directly by user scripts).
There is no `insomnia.parentFolders` / `insomnia.folders` public property — `parentFolders` is a private field on `InsomniaObject`.

## Gotchas / notable behavior
- **The two folder-ordering JSDoc comments in this codebase appear to disagree, and `findValue` is not what scripts actually go through for `insomnia.variables`.** `ParentFolders`'s constructor doc says its `folders` array is ordered "from bottom to top" (i.e. index `0` = nearest/bottom, last index = topmost ancestor). `findValue`'s own doc says it searches "starting from the nearest ancestor folder and moving towards the top ancestor folder." But the implementation does `[...this.folders].reverse().find(...)` — reversing a bottom-to-top array produces a top-to-bottom traversal, which is the *opposite* of what `findValue`'s own docstring claims. Treat `findValue`'s precedence as unverified/possibly inverted from its documented intent, and confirm against the actual call order at the construction site (`packages/insomnia/src/network/network.ts`, outside this SDK package) before relying on it to debug a specific precedence question. Note also that `findValue` is a standalone utility on `ParentFolders` — it is **not** what `insomnia.variables.get(...)` uses.
- **`insomnia.variables.get(...)`'s folder precedence is governed by `mergeFolderLevelVars` in `environments.ts`, not by `ParentFolders.findValue`.** `mergeFolderLevelVars` merges the `folderLevelVars: Environment[]` array left-to-right with **later array entries winning** (`{...merged, ...folderLevelEnv.toObject()}`), and `ParentFolders.getEnvironments()` (used to build that array) preserves the original, non-reversed `this.folders` order. Per `environments.test.ts`'s `'variables operations'` test, `folders.getEnvironments()` is passed directly as `folderLevelVars`, and mutating the folder passed **second** to the `ParentFolders` constructor (`folder2`) is what wins in `variables.get('value')` — i.e. whichever folder appears later in the array given to `new ParentFolders([...])` wins ties in `insomnia.variables`, regardless of what "nearest"/"topmost" means in that particular caller's ordering convention.
- `get`, `getById`, and `getByName` all throw plain `Error`s (not a custom error type) with a template string — safe to catch with a generic `try/catch` but there's no error code to switch on.
- `Folder.environment`'s name is derived (`${id}.environment`), not the folder's own `name` — don't assume `folder.environment.name === folder.name`.

## Related
- `environments.ts` — `Folder.environment` is an `Environment` instance; `ParentFolders.getEnvironments()` supplies `Variables`'s `folderLevelVars`, and `mergeFolderLevelVars` there is what actually implements the effective folder-variable precedence used by `insomnia.variables`.
- `insomnia.ts` — constructs `ParentFolders` from `rawObj.parentFolders` and wires `getEnvironments()` into the `Variables` constructor; exposes `parentFolders.toObject()` via `InsomniaObject.toObject()`.
- `index.ts` — re-exports `Folder` (but not `ParentFolders`) at the top level; `collection.ts` also re-exports `Folder`.
