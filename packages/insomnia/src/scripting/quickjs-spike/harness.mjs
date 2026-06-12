/* eslint-disable no-undef */
// QuickJS-WASM sandbox spike for Insomnia scripts.
// Measures the marshaling cost of moving user scripts from the current same-realm
// AsyncFunction model into a separate QuickJS engine, against a RequestContext-shaped
// payload + a pm-style API (insomnia.environment.get/set, request.headers.add,
// console.log, and an awaited insomnia.sendRequest that performs real host async I/O).
//
// Two architectures are compared head-to-head on the SAME user script:
//   A — proxy the live host object  (mirrors today's pass-by-reference; every access crosses)
//   B — bulk-copy state in, rebuild API inside the sandbox, bridge only what must escape
//
// Async note: asyncify cannot drive a host call reached from a user `await` chain, so
// sendRequest uses VM-native promises (ctx.newPromise) + a host driver loop. This works
// with the smaller, non-asyncify WASM and composes with arbitrary user await/promises.
import { getQuickJS } from 'quickjs-emscripten';

const QuickJS = await getQuickJS();
const ns = () => process.hrtime.bigint();
const ms = n => Number(n) / 1e6;

function makeState(envSize) {
  const data = { baseUrl: 'https://api.example.com' };
  for (let i = 0; i < envSize; i++) data['k' + i] = 'v' + i;
  return {
    environment: { id: 'env_1', name: 'Prod', data },
    baseEnvironment: { id: 'base_1', name: 'Base', data: {} },
    request: {
      _id: 'req_1',
      name: 'Get widgets',
      method: 'GET',
      url: 'https://api.example.com/widgets',
      headers: [{ name: 'Accept', value: 'application/json' }],
    },
    requestInfo: { eventName: 'prerequest', requestName: 'Get widgets', requestId: 'req_1' },
  };
}

// A representative pre-request script: env reads/writes in a loop, header mutation,
// a log, and an awaited sendRequest whose result is written back to the environment.
const USER_SCRIPT = `
  const base = insomnia.environment.get('baseUrl');
  for (let i = 0; i < 1000; i++) { insomnia.environment.set('counter', i); }
  let acc = 0;
  for (let i = 0; i < 1000; i++) { acc += String(insomnia.environment.get('k0')).length; }
  insomnia.request.headers.add({ key: 'X-Acc', value: String(acc) });
  console.log('script ran against', base, 'acc=', acc);
  const res = await insomnia.sendRequest('https://api.example.com/ping');
  insomnia.environment.set('lastStatus', res.status);
`;

async function hostSendRequest(url) {
  await new Promise(r => setTimeout(r, 1)); // real async I/O the sandbox cannot do itself
  return { status: 200, url, body: '{"ok":true}' };
}

// Wrap the user script so its tail promise is observable, then drive the VM event loop
// (interleaved with Node's) until that promise settles.
async function runUserScript(ctx, crossingsRef) {
  const wrapped = `globalThis.__done = (async () => { ${USER_SCRIPT} })();`;
  ctx.unwrapResult(ctx.evalCode(wrapped)).dispose();
  const start = Date.now();
  while (true) {
    ctx.runtime.executePendingJobs();
    const h = ctx.getProp(ctx.global, '__done');
    const st = ctx.getPromiseState(h);
    h.dispose();
    if (st.type !== 'pending') {
      if ('value' in st && st.value?.dispose) st.value.dispose();
      if ('error' in st && st.error?.dispose) st.error.dispose();
      if (st.type === 'rejected') throw new Error('script rejected');
      return;
    }
    await new Promise(r => setTimeout(r, 0));
    if (Date.now() - start > 5000) throw new Error('drive timeout');
  }
}

// Native-promise sendRequest bridge (shared by both strategies). One crossing per call.
function installSendRequest(ctx, crossingsRef) {
  const fn = ctx.newFunction('__sendRequest', urlH => {
    crossingsRef.n++;
    const url = ctx.getString(urlH);
    const promise = ctx.newPromise();
    hostSendRequest(url).then(res => {
      const h = ctx.newString(JSON.stringify(res));
      promise.resolve(h);
      h.dispose();
      ctx.runtime.executePendingJobs();
    });
    return promise.handle;
  });
  ctx.setProp(ctx.global, '__sendRequest', fn);
  fn.dispose();
}

// ===== STRATEGY A — proxy the live host object; every access is a boundary crossing =====
async function strategyA(envSize) {
  const ctx = QuickJS.newContext();
  const crossings = { n: 0 };
  const host = makeState(envSize);

  const reg = (name, fn) => {
    const h = ctx.newFunction(name, (...a) => {
      crossings.n++;
      return fn(...a);
    });
    ctx.setProp(ctx.global, name, h);
    h.dispose();
  };
  reg('__envGet', k => ctx.newString(String(host.environment.data[ctx.getString(k)] ?? '')));
  reg('__envSet', (k, v) => {
    host.environment.data[ctx.getString(k)] = ctx.dump(v);
  });
  reg('__headerAdd', h => {
    const o = ctx.dump(h);
    host.request.headers.push({ name: o.key, value: o.value });
  });
  reg('__log', () => {});
  installSendRequest(ctx, crossings);

  ctx
    .unwrapResult(
      ctx.evalCode(`
    globalThis.insomnia = {
      environment: { get: k => __envGet(k), set: (k, v) => __envSet(k, v) },
      request: { headers: { add: h => __headerAdd(h) } },
      sendRequest: u => __sendRequest(u).then(s => JSON.parse(s)),
    };
    globalThis.console = { log: (...a) => __log(...a) };
  `),
    )
    .dispose();

  const t0 = ns();
  await runUserScript(ctx, crossings);
  const elapsed = ms(ns() - t0);
  ctx.dispose();
  return {
    crossings: crossings.n,
    elapsed,
    headers: host.request.headers.length,
    lastStatus: host.environment.data.lastStatus,
  };
}

// ===== STRATEGY B — bulk-copy in, rebuild API inside sandbox, bridge only escapes =====
async function strategyB(envSize) {
  const ctx = QuickJS.newContext();
  const crossings = { n: 0 };
  const host = makeState(envSize);

  const logFn = ctx.newFunction('__log', () => {
    crossings.n++;
  });
  ctx.setProp(ctx.global, '__log', logFn);
  logFn.dispose();
  installSendRequest(ctx, crossings);

  const tIn = ns();
  const sh = ctx.newString(JSON.stringify(host)); // CROSSING: bulk state in (1 string)
  ctx.setProp(ctx.global, '__stateJson', sh);
  sh.dispose();
  crossings.n++;
  const inMs = ms(ns() - tIn);

  ctx
    .unwrapResult(
      ctx.evalCode(`
    const __state = JSON.parse(__stateJson);
    globalThis.insomnia = {
      environment: { get: k => __state.environment.data[k], set: (k, v) => { __state.environment.data[k] = v; } },
      request: { headers: { add: h => { __state.request.headers.push({ name: h.key, value: h.value }); } } },
      sendRequest: u => __sendRequest(u).then(s => JSON.parse(s)),
    };
    globalThis.console = { log: (...a) => __log(...a) };
    globalThis.__dumpState = () => JSON.stringify(__state);
  `),
    )
    .dispose();

  const t0 = ns();
  await runUserScript(ctx, crossings);
  const runMs = ms(ns() - t0);

  const tOut = ns();
  const outH = ctx.unwrapResult(ctx.evalCode('__dumpState()')); // CROSSING: bulk state out (1 string)
  const mutated = JSON.parse(ctx.getString(outH));
  outH.dispose();
  crossings.n++;
  const outMs = ms(ns() - tOut);

  ctx.dispose();
  return {
    crossings: crossings.n,
    elapsed: runMs,
    inMs,
    outMs,
    headers: mutated.request.headers.length,
    lastStatus: mutated.environment.data.lastStatus,
  };
}

async function microBench(envSize) {
  const ctx = QuickJS.newContext();
  const noop = ctx.newFunction('__noop', () => {});
  ctx.setProp(ctx.global, '__noop', noop);
  noop.dispose();
  const N = 100_000;
  ctx.unwrapResult(ctx.evalCode('globalThis.__spin = n => { for (let i=0;i<n;i++) __noop(); }')).dispose();
  const callFn = ctx.getProp(ctx.global, '__spin');
  const t0 = ns();
  ctx.unwrapResult(ctx.callFunction(callFn, ctx.undefined, ctx.newNumber(N))).dispose();
  const perCrossingNs = Number(ns() - t0) / N;
  callFn.dispose();
  const json = JSON.stringify(makeState(envSize));
  ctx.dispose();
  return { perCrossingNs, payloadBytes: json.length };
}

for (const envSize of [50, 500]) {
  console.log(`\n================  env vars: ${envSize}  ================`);
  const micro = await microBench(envSize);
  console.log(`payload ${micro.payloadBytes} bytes | per-crossing ≈ ${micro.perCrossingNs.toFixed(0)} ns`);
  const a = await strategyA(envSize);
  const b = await strategyB(envSize);
  console.log(`A  proxy live object   crossings=${String(a.crossings).padStart(5)}  run=${a.elapsed.toFixed(2)} ms`);
  console.log(
    `B  bulk-copy + bridge  crossings=${String(b.crossings).padStart(5)}  run=${b.elapsed.toFixed(2)} ms  (state in ${b.inMs.toFixed(2)} / out ${b.outMs.toFixed(2)} ms)`,
  );
  console.log(`   fidelity — headers A=${a.headers} B=${b.headers} | lastStatus A=${a.lastStatus} B=${b.lastStatus}`);
  console.log(
    `   → ${(a.crossings / b.crossings).toFixed(0)}× fewer crossings, ${(a.elapsed / b.elapsed).toFixed(1)}× faster run`,
  );
}
