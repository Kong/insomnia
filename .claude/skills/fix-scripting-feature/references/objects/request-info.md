# RequestInfo (`insomnia.info` / `pm.info`)

**Source:** `packages/insomnia-scripting-environment/src/objects/request-info.ts`

## Purpose
Models `pm.info`: metadata about which script phase is executing and, for the collection runner,
which iteration is in progress. Read-oriented — scripts typically branch on `insomnia.info.eventName`
or log `insomnia.info.iteration`/`iterationCount`.

## Public API

### `type EventName = 'prerequest' | 'test'`
The name of the event that triggered the script: `'prerequest'` (before a request is sent) or
`'test'` (during the testing/after-response phase).

### `interface RequestInfoOption`
```ts
interface RequestInfoOption {
  eventName?: EventName;
  iteration?: number;
  iterationCount?: number;
  requestName?: string;
  requestId?: string;
}
```
Plain-object shape used to construct a `RequestInfo` (and stored on `RequestContext.requestInfo`, see `interfaces.md`).

### `class RequestInfo`
```ts
constructor(options: RequestInfoOption)
```
Public properties (plain, mutable, non-readonly):
- `eventName: EventName` — defaults to `'prerequest'` if not provided (`options.eventName || 'prerequest'`).
- `iteration: number` — defaults to `1` (`options.iteration || 1`).
- `iterationCount: number` — defaults to `1` (`options.iterationCount || 1`).
- `requestName: string` — defaults to `''`.
- `requestId: string` — defaults to `''`.

Method:
- `toObject = () => ({ eventName, iteration, iterationCount, requestName, requestId })` — plain serialization, same shape as `RequestInfoOption` with all fields always populated.

## Script-facing surface
- `insomnia.info.eventName` — `'prerequest'` or `'test'`, useful for scripts shared between pre-request and test tabs.
- `insomnia.info.iteration` — current collection-runner iteration number (1-based).
- `insomnia.info.iterationCount` — total number of iterations configured for the run.
- `insomnia.info.requestName` — display name of the request being executed.
- `insomnia.info.requestId` — the request's unique id.

## Gotchas / notable behavior
- All five properties are **plain public fields**, not readonly — a script can reassign
  `insomnia.info.iteration = 99` and nothing in this class prevents it. In practice this has no
  effect on the actual collection-runner state: `packages/insomnia/src/scripting/run-script.ts`'s
  merge logic (building the returned `RequestContext`) does not read `requestInfo` back out of the
  mutated `InsomniaObject` at all, so any script-side mutation of `insomnia.info` is silently
  discarded after the script finishes.
- The `||` fallback pattern means an explicit `0` for `iteration`/`iterationCount` is treated the
  same as "not provided" and coerced to `1`. Notably, `initInsomniaObject` (in `insomnia.ts`)
  builds the options with `iterationCount: rawObj.requestInfo.iterationCount || 0` — but since `0`
  is falsy, the `RequestInfo` constructor's own `|| 1` fallback still turns that back into `1`, so
  `iterationCount` effectively can never legitimately be `0` through this path.
- A `// TODO: update follows when post-request script and iterationData are introduced` comment on
  the call site in `insomnia.ts` suggests the `eventName`/iteration wiring for after-response
  scripts may still be incomplete.

## Related
- `insomnia.ts` — `InsomniaObject.info: RequestInfo`; `initInsomniaObject` builds it from `rawObj.requestInfo` plus `rawObj.request.name`/`_id`.
- `interfaces.ts` — `RequestInfoOption` is embedded as `RequestContext.requestInfo`.
- `packages/insomnia/src/scripting/run-script.ts` — supplies the initial `RequestInfoOption` per script phase (pre-request vs. test) and — notably — does not persist script-side mutations back into `RequestContext`.
- `__tests__/request-info.test.ts` — covers default values and `toObject()` shape for both single-request and collection-runner (`iteration`/`iterationCount`) cases.
