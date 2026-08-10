# Delayed / excluded modules

Modules considered for `quickjs-legacy-module-porting-plan.md` but excluded from that round. Each needs a decision or a separate design pass before a milestone can be written for it.

## `stream`

Legacy handed plugins the real `node:stream`. A pure-JS reimplementation covering backpressure, `pipe`, `Readable`/`Writable`/`Transform` internals is a multi-week undertaking disproportionate to likely plugin demand. Revisit only if a real plugin need is demonstrated; consider scoping to a minimal `EventEmitter`-based stub rather than full fidelity if so.

## `insomnia-collection` / `postman-collection`

The exported `Collection` data-model classes (`Request`, `Response`, `Cookie`, `Header`, `Url`, `Variable`, etc., from `packages/insomnia-scripting-environment/src/objects/index.ts`) are pure data holders and structurally portable. The risk is the module boundary: that package also contains `send-request.ts` (holds a live `window.bridge.curlRequest` reference) and `insomnia.ts`/`execution.ts`. Porting safely requires proving no transitive import from the ported surface reaches those files — an import-boundary audit, not a straightforward port. Needs its own design pass before a milestone can be written.

## `timers`

Legacy exposed real `node:timers` (minus `setImmediate`). Two options exist with a real behavioral tradeoff:
- Bridge to real host timers with hard caps (max count, max delay, forced teardown) — preserves legacy semantics (a `setTimeout(fn, 100)` still waits ~100ms) but adds real host-timing surface to review.
- A synthetic in-sandbox scheduler that never touches a real host timer — safer in isolation, but real delays wouldn't actually wait, silently changing plugin behavior versus legacy.

Needs a decision before implementation starts.

## `tv4`

Superseded by `ajv`, which is already vendored and strictly more capable/maintained. Only worth revisiting if some legacy plugin is found calling `require('tv4')` directly rather than `require('ajv')` for its JSON-schema validation — otherwise it's added surface for no functional gain.
