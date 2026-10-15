# collection.ts (re-export barrel — no `Collection` class)

**Source:** `packages/insomnia-scripting-environment/src/objects/collection.ts`

## Purpose
**This file does not define a `Collection` class, and has no logic of its own.** Its entire content is a JSDoc `@module` comment plus eleven `export { ... } from '...'` re-export statements:
```ts
export { RequestAuth } from './auth';
export { Certificate } from './certificates';
export { Cookie, CookieList } from './cookies';
export { Header, HeaderList } from './headers';
export { Property, PropertyBase, PropertyList } from './properties';
export { ProxyConfig, ProxyConfigList } from './proxy-configs';
export { FormParam, Request, RequestBody } from './request';
export { Response } from './response';
export { QueryParam, Url, UrlMatchPattern, UrlMatchPatternList } from './urls';
export { Variable, VariableList } from './variables';
export { Folder } from './folders';
```
It exists purely so that `index.ts` can do `export * as Collection from './collection'`, giving SDK/type consumers a `Collection.Property`, `Collection.Variable`, `Collection.Folder`, etc. namespace (mirroring the Postman `postman-collection` package's `Collection.*` type namespace for compatibility/familiarity). There is no runtime behavior, no constructor, and nothing related to collection-scoped *variable storage* in this file.

## Public API
No classes/functions of its own. It re-exports (unchanged) the following, whose real definitions and docs live in their own files:
- `RequestAuth` (`auth.ts`)
- `Certificate` (`certificates.ts`)
- `Cookie`, `CookieList` (`cookies.ts`)
- `Header`, `HeaderList` (`headers.ts`)
- `Property`, `PropertyBase`, `PropertyList` (`properties.ts` — see `properties.md`)
- `ProxyConfig`, `ProxyConfigList` (`proxy-configs.ts`)
- `FormParam`, `Request`, `RequestBody` (`request.ts`)
- `Response` (`response.ts`)
- `QueryParam`, `Url`, `UrlMatchPattern`, `UrlMatchPatternList` (`urls.ts`)
- `Variable`, `VariableList` (`variables.ts` — see `variables.md`)
- `Folder` (`folders.ts` — see `folders.md`)

Note this list is nearly identical to `index.ts`'s own top-level JSDoc module comment (both files carry the same doc block), but `index.ts` itself re-exports far more (all of `environments.ts`, `insomnia.ts`, `test.ts`, `execution.ts`, etc.) in addition to wrapping this file as the `Collection` namespace.

## Script-facing surface
No direct script-facing surface of its own. **If you are looking for how `pm.collectionVariables` actually works** (collection-level variable storage and resolution), that logic lives in:
- `environments.ts` — the `Environment` class backing the actual store.
- `insomnia.ts` — `InsomniaObject` explicitly maps `this.collectionVariables = this.baseEnvironment` (i.e. `pm.collectionVariables` **is** `pm.baseEnvironment`, the same `Environment` instance, not a separate object) and constructs the `Variables` hierarchy (`collectionVars: baseEnvironment`) used by `pm.variables`.
See `environments.md` for the full precedence/resolution behavior.

## Gotchas / notable behavior
- **Naming trap**: a file named `collection.ts` in a scripting/variable-resolution context strongly suggests a `Collection` class with collection-variable logic — it has none. Anyone debugging "collection variables" behavior should look at `environments.ts` (`Environment`) and `insomnia.ts` (`collectionVariables = baseEnvironment` aliasing), not this file.
- Diffed byte-for-byte against `index.ts`'s doc comment: the JSDoc header text is duplicated between the two files, but the actual export lists differ — `collection.ts` only re-exports a subset (the "Postman-collection-shaped" types), while `index.ts` re-exports everything including `insomnia.ts`, `environments.ts`, `console.ts`, `execution.ts`, `test.ts`, `async-objects.ts`, `request-info.ts`.
- `index.ts` wraps this file's exports under a namespace: `export * as Collection from './collection';` — so external consumers see `Collection.Variable`, `Collection.Folder`, etc., but that `Collection` namespace object is not related to `pm.collectionVariables` at runtime; it's purely a type/value re-export grouping.

## Related
- `index.ts` — re-exports this file's contents as the `Collection` namespace (`export * as Collection from './collection'`).
- `environments.ts` — actual implementation backing `pm.collectionVariables`/`pm.baseEnvironment` (see `environments.md`).
- `insomnia.ts` — wires `collectionVariables` to `baseEnvironment` and builds the `Variables` hierarchy.
- `properties.ts`, `variables.ts`, `folders.ts`, `urls.ts`, `request.ts`, `response.ts`, `cookies.ts`, `headers.ts`, `auth.ts`, `certificates.ts`, `proxy-configs.ts` — the actual modules whose types this file re-exports.
