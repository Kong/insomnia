# Test handler (pm.test / test())

**Source:** `packages/insomnia-scripting-environment/src/objects/test.ts`

## Purpose
Implements the `test()`/`skip()` handler that backs `pm.test(...)` (and `insomnia.test(...)`), plus the bookkeeping used by the script-execution harness to know when all in-flight test callbacks have settled before the script finishes. This is the only file responsible for turning a user's test callback into a `RequestTestResult` record.

## Public API

### `test(msg, fn, log)`
```ts
export async function test(
  msg: string,
  fn: () => Promise<void>,
  log: (testResult: RequestTestResult) => void
): Promise<void>
```
- Wraps `fn` in an async closure (`wrapFn`), times its execution with `performance.now()`, awaits it, and calls `log(...)` with a `RequestTestResult`:
  - On success: `{ testCase: msg, status: 'passed', executionTime, category: 'unknown' }`.
  - On thrown error `e`: `{ testCase: msg, status: 'failed', executionTime, errorMessage: `error: ${e} | ACTUAL: ${e.actual} | EXPECTED: ${e.expected}`, category: 'unknown' }`.
- Immediately invokes `wrapFn()`, registers the resulting promise with `startTestObserver`, and returns that same promise (`testPromise`) — i.e. `test()` itself resolves once the wrapped test body (pass or fail) has finished running.
- `category` is always hardcoded to `'unknown'` here even though `RequestTestResult.category` (in `insomnia-data`) also allows `'pre-request'` and `'after-response'`.

### `skip(msg, _, log)`
```ts
export async function skip(
  msg: string,
  _: () => Promise<void>,
  log: (testResult: RequestTestResult) => void
): Promise<void>
```
- Does **not** call `fn` (the second argument is ignored). Immediately calls `log({ testCase: msg, status: 'skipped', executionTime: 0, category: 'unknown' })`.

### `resetTestPromises()`
```ts
export function resetTestPromises(): void
```
- Clears the module-level `testPromises` array (`testPromises = []`). Used to reset state between script executions so promises from a previous run aren't awaited again.

### `waitForAllTestsDone()`
```ts
export async function waitForAllTestsDone(): Promise<void>
```
- Awaits `Promise.allSettled(testPromises)` (captured as `NativePromise` at module load, so it isn't affected by any sandbox-level `Promise` patching), then resets `testPromises` back to `[]`.
- This is the drain point the execution harness calls at the end of a script run to make sure every `pm.test(...)` callback (including ones the script itself didn't `await`) has finished before results are collected.

### `startTestObserver(promise)` (not exported)
```ts
function startTestObserver(promise: Promise<void>): void
```
- Pushes `promise` onto the module-level `testPromises` array. Called once per `test()` invocation.

### `TestHandler` interface
```ts
export interface TestHandler {
  (msg: string, fn: () => Promise<void>): Promise<void>;
  skip?: (msg: string, fn: () => Promise<void>) => void;
}
```
- Callable interface shape used by the object model to type the value returned for `pm.test` — a function that also carries an optional `.skip` method.

## Script-facing surface
- `pm.test('name', async () => { ... })` / `insomnia.test('name', fn)` — registers and immediately runs a test, recording a pass/fail result.
- `pm.test.skip('name', fn)` — records a `skipped` result without running `fn`.
- There is no bare global `test`/`skip` exposed directly by this file; script-facing exposure happens through the `insomnia`/`pm` object (see Related).

## Gotchas / notable behavior
- **Fire-and-forget by default:** `test()` starts executing the test body synchronously (well, as soon as the async function runs) and returns a promise, but scripts are not required to `await pm.test(...)`. Because every test promise is also pushed into the shared `testPromises` array via `startTestObserver`, un-awaited tests are still tracked and will be waited on by `waitForAllTestsDone()` before the script finishes — this is what prevents test results from being lost when a script fires multiple `pm.test()` calls without awaiting them.
- **Module-level mutable state:** `testPromises` is a module-level array, not per-execution-context state. `resetTestPromises()` must be called before a script runs and `waitForAllTestsDone()` after, or results/timing from different executions could leak into each other (relevant if concurrent script executions ever share this module instance).
- **Error message shape assumes chai-style errors:** the failure branch does `` `error: ${e} | ACTUAL: ${e.actual} | EXPECTED: ${e.expected}` ``, which assumes `e` has `.actual`/`.expected` (true for chai `AssertionError`s from `insomnia.expect(...)`). For a plain thrown `Error` or non-chai exception, `ACTUAL`/`EXPECTED` will stringify as `undefined`.
- **`category` is never anything but `'unknown'`** from this module — any pre-request vs. after-response distinction in `RequestTestResult.category` must be set elsewhere (or is currently unused/always `'unknown'` for script-originated tests).
- **`NativePromise` capture:** `const NativePromise = Promise;` is captured at module import time specifically so `waitForAllTestsDone`'s `allSettled` call uses the real, un-sandboxed `Promise`, not a possibly-patched one from the script sandbox.

## Related
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — wires `test`/`skip` into the `InsomniaObject`. The constructor returns a `Proxy` whose `get` trap intercepts `prop === 'test'` and returns a `TestHandler` closure calling `this._test(msg, fn, this.pushRequestTestResult)` (and `.skip` calling `this._skip(...)`); `pushRequestTestResult` appends to `this.requestTestResults: RequestTestResult[]`, later returned from `toObject()`.
- `packages/insomnia-scripting-environment/src/objects/async-objects.ts` — calls `resetTestPromises()` once at module load alongside its own promise-tracking logic for `ProxiedPromise`.
- `packages/insomnia/src/scripting/sandbox.ts` (`prepareSandbox`) and `packages/insomnia/src/scripting/run-script.ts` — the harness that injects `__waitForAllTestsDone__` into the generated script function and awaits it (`await __waitForAllTestsDone__();`) before returning the mutated `insomnia` object; `run-script.ts` then reads `mutatedInsomniaObject.toObject().requestTestResults` and includes it in the returned `RequestContext`.
- `packages/insomnia-data` (`RequestTestResult`, `TestStatus`, `TestCategory` in `src/models/runner-test-result.ts`) — the result shape this file produces.
- UI consumers of the resulting test results: `packages/insomnia/src/ui/components/panes/request-test-result-pane.tsx` and `request-result-card.tsx`.
