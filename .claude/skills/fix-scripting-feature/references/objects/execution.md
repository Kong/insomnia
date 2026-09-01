# Execution (`insomnia.execution` / `pm.execution`)

**Source:** `packages/insomnia-scripting-environment/src/objects/execution.ts`

## Purpose
Models `pm.execution`: where the currently-running request sits in the collection tree, plus two
collection-runner controls — skipping the request and rerouting to a different next request. This
is one of the fields the collection runner reads back after a script finishes.

## Public API

### `interface ExecutionOption`
```ts
interface ExecutionOption {
  location: string[];
  skipRequest?: boolean;
  nextRequestIdOrName?: string;
}
```
Plain-object shape used to construct an `Execution` (and the shape stored on `RequestContext.execution`, see `interfaces.md`).

### `class Execution`
```ts
constructor(options: ExecutionOption)
```
- `public location: string[]` — **not a plain array**: the constructor wraps a shallow copy
  (`[...location]`) in a `Proxy` whose `get` trap adds a `current` accessor returning
  `target.length > 0 ? target[target.length - 1] : ''` (the last path segment, or `''` if empty),
  mirroring Postman's `execution.location.current` usage. All other property/index access passes
  through via `Reflect.get`. Throws `TypeError('Location input must be array of string')` if
  `options.location` is not an array.
- `private _skipRequest: boolean` (default `false`), `private _nextRequestIdOrName: string` (default `''`) — no direct getters; only visible via `toObject()`.
- `skipRequest = () => { this._skipRequest = true; }` — one-way flag setter; there is no method to un-set it.
- `setNextRequest = (requestIdOrName: string) => { this._nextRequestIdOrName = requestIdOrName; }` — records which request the collection runner should execute next.
- `toObject = () => ({ location: Array.from(this.location), skipRequest: this._skipRequest, nextRequestIdOrName: this._nextRequestIdOrName })` — serializes state to a plain object; `Array.from` strips the `Proxy`, so the resulting `location` array **loses the `.current` accessor**.

## Script-facing surface
- `insomnia.execution.location` — array of path segments (e.g. `['project', 'workspace', 'file', 'requestname']`).
- `insomnia.execution.location.current` — last segment of the location path (Postman-compat).
- `insomnia.execution.skipRequest()` — marks the current request to be skipped.
- `insomnia.execution.setNextRequest(requestIdOrName)` — reroutes the collection runner to a specific request by id or name.

## Gotchas / notable behavior
- `location.current` only works on the live `Proxy`-wrapped array returned from the constructor;
  once serialized via `toObject()` (which uses `Array.from`), the plain array no longer has
  `.current`. This only matters for the runtime maintainers reading `toObject()`'s output — script
  authors reading `insomnia.execution.location.current` directly are unaffected.
- Passing a non-array `location` (e.g. a string) throws a `TypeError` synchronously from the
  constructor — this is a `initInsomniaObject`/context-building bug, not something a script can
  trigger directly, since scripts only read `insomnia.execution`, they don't construct it.
- There's no public getter for `skipRequest`/`nextRequestIdOrName` state from the script side —
  scripts can only set them, not read them back; only `toObject()` (used internally when the
  runtime merges results into the persisted request context) exposes the current values.
- Comment references Postman's docs on "using variables in scripts" for the `location.current`
  design: https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-api-reference/#using-variables-in-scripts

## Related
- `insomnia.ts` — `InsomniaObject.execution: Execution`; `toObject()` calls `execution.toObject()`.
- `interfaces.ts` — `ExecutionOption` is embedded as `RequestContext.execution`.
- `packages/insomnia/src/scripting/run-script.ts` — merges `mutatedContextObject.execution` (i.e. `Execution.toObject()`'s output) back into the returned `RequestContext` so the collection runner can act on `skipRequest`/`nextRequestIdOrName`.
- `__tests__/execution.test.ts` — covers the `location`/`current` proxy behavior, `skipRequest()`/`setNextRequest()`, and the invalid-`location` throw.
