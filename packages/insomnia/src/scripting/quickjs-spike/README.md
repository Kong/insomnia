# QuickJS-WASM sandbox spike

Throwaway spike measuring the marshaling cost of running Insomnia pre/post-request
scripts inside a **QuickJS-WASM** engine instead of the current same-realm
`AsyncFunction` model in [`run-script.ts`](../run-script.ts) / [`sandbox.ts`](../sandbox.ts).

Not wired into the app. Runs standalone so the numbers don't depend on the monorepo.

## Run it

```bash
mkdir /tmp/qjs && cd /tmp/qjs && npm init -y && npm i quickjs-emscripten
cp <repo>/packages/insomnia/src/scripting/quickjs-spike/harness.mjs .
node harness.mjs
```

## What it compares

The same representative pre-request script (env get/set loops, header mutation,
`console.log`, and an awaited `insomnia.sendRequest` doing real host async I/O) is
run through two architectures:

- **A — proxy the live host object.** Mirrors today's pass-by-reference: every
  `insomnia.environment.get/set`, header add, log, and sendRequest is a host
  function, i.e. a WASM boundary crossing.
- **B — bulk-copy state in, rebuild the API *inside* the sandbox, bridge only what
  must escape** (console + async sendRequest), copy mutated state back out.

## Results (M-series laptop, QuickJS 0.32, non-asyncify variant)

```
env vars: 50    per-crossing ≈ 1473 ns
A  proxy live object   crossings= 2005  run=13.07 ms
B  bulk-copy + bridge  crossings=    4  run= 1.92 ms  (state in 0.02 / out 0.13 ms)
  → 501× fewer crossings, 6.8× faster

env vars: 500   per-crossing ≈ 1229 ns
A  proxy live object   crossings= 2005  run= 5.70 ms
B  bulk-copy + bridge  crossings=    4  run= 1.97 ms  (state in 0.11 / out 0.52 ms)
  → 501× fewer crossings, 2.9× faster
```

Fidelity check passes both ways (`lastStatus=200` written back from the awaited
sendRequest; header added).

## Findings

1. **A boundary crossing costs ~1.2–1.5 µs.** Cheap individually, but the current
   API is chatty — a real script touches `environment`/`variables`/`request`
   hundreds–thousands of times. The cost is dominated by *crossing count*, which is
   an **architecture** choice, not a QuickJS limitation.

2. **Don't proxy the live `InsomniaObject` method-by-method.** That's the natural
   port of today's pass-by-reference model and it's the slow path. Instead serialize
   the `RequestContext` / `toObject()` surface in once, reconstruct the `pm`/`insomnia`
   API in pure JS *inside* the sandbox over local state, and read mutated state back
   out once. Bulk JSON copy of a 7 KB payload is ~0.1 ms in / ~0.5 ms out.

3. **Async is the real integration work, and asyncify is the wrong tool here.**
   `newAsyncifiedFunction` only drives a host call reached on the *synchronous* eval
   path. A host call reached from a user `await` chain (which every pm script has —
   `await pm.sendRequest`, awaited assertions) collides with the job pump
   (`cannot handle error in suspended function` / use-after-free). The robust pattern
   is **VM-native promises** (`ctx.newPromise()`): the host returns a real QuickJS
   promise, resolves it from Node, and a **driver loop** interleaves
   `runtime.executePendingJobs()` with Node's event loop until the script's tail
   promise settles. This composes with arbitrary user await/promise chains and works
   with the smaller **non-asyncify** WASM. See `runUserScript` in `harness.mjs`.

4. **This driver loop is the QuickJS equivalent of the existing
   `__bridgeReset__`/`__bridgeSettle__` async-task monitor** in `run-script.ts` — the
   same "wait for all the script's async work to settle before reading results"
   problem, solved at the engine boundary instead of via `setTimeout` proxying.

## Implications for a real port

- Portable by construction: one `.wasm`, identical in renderer / main / UtilityProcess
  / the `inso` CLI. No native rebuild, no `vm2`.
- Reuse `InsomniaObject.toObject()` as the serialize-in / merge-out contract — it
  already defines the exact state surface that needs to cross.
- The `pm`/`insomnia` API (environments, variables, request, headers, cookies, test,
  expect) must be **reimplemented in-sandbox** over plain state. Only `sendRequest`,
  `console`, and any vault/secret access need host bridges.
- Cost to budget: API reimplementation inside the sandbox + the async driver loop.
  Marshaling itself is not the bottleneck if you avoid the per-access proxy.
```
