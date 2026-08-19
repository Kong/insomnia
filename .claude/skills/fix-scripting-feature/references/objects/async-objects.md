# Async plumbing (`ProxiedPromise`)

**Source:** `packages/insomnia-scripting-environment/src/objects/async-objects.ts`

## Purpose
Internal plumbing (not part of the `pm`/`insomnia` script-facing API by name) that lets the sandbox
track every `Promise` a user script creates, so it can drain/await fire-and-forget promises before
handing control back to the host app. This is what prevents an un-awaited `.then()` chain or a
stray `setTimeout`-driven promise inside a script from silently continuing (or erroring) after the
script has already "finished".

## Public API

- `export const OriginalPromise = Promise;` — a stashed reference to the real native `Promise`
  class, captured at module load before anything replaces the global `Promise`.
- `export class ProxiedPromise<T> extends Promise<T>` — drop-in `Promise` replacement:
  - `constructor(executor)` — behaves exactly like `Promise`, and additionally pushes `this` into
    the module-level `scriptPromises` array if `monitoring` is `true`.
  - `static override all(promises: Promise<any>[])` — delegates to `super.all(promises)`; pushes
    the resulting promise into `scriptPromises` if `monitoring`.
  - `static override allSettled(promises: Promise<any>[])` — delegates to `super.allSettled(promises)` only; does **not** push the result into `scriptPromises` (comment: "promise will be counted in Promise.resolve").
  - `static any(_: Promise<any>[])` — **not actually overridden** (no `override` keyword, does not call `super.any`); always returns `super.reject("'super.any' not supported")`. Comment notes `Promise.any` isn't supported for the ES2021 compile target.
  - `static override race(promises: Promise<any>[])` — delegates to `super.race(promises)`; pushes the result if `monitoring`.
  - `static override reject(value: any)` — delegates to `super.reject(value)`; pushes the result if `monitoring`.
  - `static override resolve<T>(value?: T | PromiseLike<T>)` — delegates to `super.resolve(value)`; pushes the result if `monitoring`.
  - `static withResolvers()` — always returns `super.reject("'Promise.withResolvers' not supported")`; same ES2021 compile-target limitation noted in a comment.
- `export const asyncTasksAllSettled = async () => { await Promise.allSettled(scriptPromises); scriptPromises = []; }` — awaits every currently-tracked promise, then clears the tracked list.
- `export const stopMonitorAsyncTasks = () => { monitoring = false; }` — disables tracking of any *new* promises created after this call.
- `export const resetAsyncTasks = async () => { scriptPromises = []; monitoring = true; }` — clears the tracked list and re-enables monitoring; called at the start of a fresh script run.

Module-level (shared, not per-instance) state: `let monitoring = true;` and
`let scriptPromises = new Array<Promise<any>>();`. Importing this module also calls
`resetTestPromises()` (from `./test`) once, as a side effect at load time.

## Script-facing surface
None of these names are called directly by a user script. However, the mechanism *is* in the
script-facing surface indirectly: `packages/insomnia/src/entry.hidden-window-preload.ts` replaces
the sandbox's global `Promise` with `ProxiedPromise`
(`contextBridge.exposeInMainWorld('Promise', ProxiedPromise); window.Promise = ProxiedPromise;`),
so every `new Promise(...)`, `async function`, `Promise.resolve(...)`, `Promise.all(...)`, etc. a
script writes is transparently tracked. `packages/insomnia/src/scripting/run-script.ts` injects
`resetAsyncTasks`/`stopMonitorAsyncTasks`/`asyncTasksAllSettled` into the executed script function
as `__bridgeReset__`/`__bridgeStop__`/`__bridgeSettle__`, calling `__bridgeReset__()` before the
user script body runs and `await __bridgeSettle__()` after it, right before returning the mutated
`insomnia` object. This is what makes an un-awaited `pm.sendRequest(...)` callback or stray
`.then()` still resolve before the script's result is used.

## Gotchas / notable behavior
- `Promise.any(...)` and `Promise.withResolvers()` are **explicitly unsupported**: calling either
  from a script returns a promise that rejects with the literal string `"'super.any' not supported"`
  or `"'Promise.withResolvers' not supported"` (not a real `Error` object) — worth checking for if a
  script's failure message looks like that.
- `allSettled` results are deliberately *not* double-counted into `scriptPromises` — the comment
  claims this is safe because "promise will be counted in Promise.resolve" (i.e. the engine's
  internal `allSettled` implementation is assumed to route through `Promise.resolve` on the inputs,
  which are already tracked). This is an implicit coupling to Promise/A+ implementation details.
- `scriptPromises`/`monitoring` are **module-level singletons**, not scoped per script execution —
  correctness across sequential script runs depends on `resetAsyncTasks()` (`__bridgeReset__`)
  being called at the start of every run; if it's ever skipped, promises from a previous run could
  leak into the next run's settle-and-drain step.
- Constructing a promise while `monitoring === false` silently skips tracking — no error or warning is raised.

## Related
- `test.ts` — `resetTestPromises()` is called once at this module's import time; test assertion promises are tracked separately from `scriptPromises`.
- `packages/insomnia/src/scripting/run-script.ts` — wires `resetAsyncTasks`/`stopMonitorAsyncTasks`/`asyncTasksAllSettled` into the sandboxed script's `__bridgeReset__`/`__bridgeStop__`/`__bridgeSettle__` calls.
- `packages/insomnia/src/entry.hidden-window-preload.ts` — replaces the sandbox's global `Promise` with `ProxiedPromise`.
- `packages/insomnia/src/scripting/sandbox.ts` — prepares the broader sandbox execution context that this async tracking runs inside.
