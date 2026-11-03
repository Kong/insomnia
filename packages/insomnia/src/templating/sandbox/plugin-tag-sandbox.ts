import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';

import type { HostBridge } from './host-bridge';
import { ACTION_RUNNER, DESCRIBE_RUNNER, HOOK_RUNNER, IN_SANDBOX_BOOTSTRAP, RUNNER } from './in-sandbox-bootstrap';
import { type ContextEnvelope, encodeBridgeFailure, encodeBridgeSuccess } from './marshal';
import { buildModuleRegistrySource } from './module-registry';
import { SANDBOX_GLOBALS_SOURCE } from './sandbox-globals';

/**
 * Synchronous crypto operations backed by the host's real crypto (node:crypto in main). Exposed as
 * sync QuickJS host functions so the in-sandbox `require('crypto')` shim works without the
 * sync/async mismatch a bridge would impose — and without reimplementing crypto in pure JS.
 */
export interface HostCrypto {
  hash(algo: string, data: string, inputEncoding: string, outputEncoding: string): string;
  hmac(algo: string, key: string, data: string, outputEncoding: string): string;
  /** Returns base64-encoded random bytes. */
  randomBytes(size: number): string;
  randomUUID(): string;
}

export interface RunTagInSandboxOptions {
  /**
   * Raw CommonJS source of the plugin's entry module. Convenience for single-file plugins/tests;
   * synthesized into `envelope.moduleFiles` as `index.js`. Ignored when the envelope already carries
   * a module map (multi-file plugins, M4).
   */
  pluginSource?: string;
  /** Name of the tag within the module to execute. Ignored (may be '') when `discover` is set. */
  tagName: string;
  /**
   * Discovery mode (L1): instead of running a tag, evaluate the plugin entry and return a JSON
   * string manifest of its exports (template-tag metadata, hook counts, action labels, themes).
   * The plugin's top-level code still runs — but inside the sandbox, never on the host.
   */
  discover?: boolean;
  /** Bulk-copied state passed to the rebuilt in-sandbox context. */
  envelope: ContextEnvelope;
  /** Host side of the async bridge — runs the real work for each `__hostBridge` call. */
  bridge: HostBridge;
  /** Sync crypto backing for the in-sandbox `require('crypto')` shim. Omit to disable crypto. */
  hostCrypto?: HostCrypto;
  /** Optional console sink for `console.*` emitted inside the sandbox. */
  onConsole?: (level: string, message: string) => void;
  /** Wall-clock cap for the whole tag run; mirrors the LiquidJS renderLimit (10s). */
  timeoutMs?: number;
}

/**
 * Execute a single plugin template tag's `run(context, ...args)` inside an isolated QuickJS context
 * and return its string result. Each call gets a fresh context that is disposed at the end, so any
 * intermediate handles are reclaimed wholesale.
 */
export const runTagInSandbox = async (opts: RunTagInSandboxOptions): Promise<string> => {
  const { pluginSource, tagName, envelope, bridge, onConsole, discover = false, timeoutMs = 10_000 } = opts;
  const { getQuickJSModule } = await import('./quickjs-runtime');
  const QuickJS = await getQuickJSModule();
  const ctx = QuickJS.newContext();
  const deadline = Date.now() + timeoutMs;
  // Bridge calls this run has initiated but not yet gotten a real response for. Tracked so a
  // timeout can force them to a settled state before disposing — otherwise the still-pending
  // promise/continuation is live when the context's runtime is freed, which crashes the engine.
  const pendingBridgeCalls = new Set<ReturnType<QuickJSContext['newPromise']>>();

  // Single-file convenience: synthesize a one-entry module map from pluginSource when the caller
  // didn't pass a multi-file map. The in-sandbox loader always resolves the entry from the map.
  const hasMap = !!envelope.moduleFiles && Object.keys(envelope.moduleFiles).length > 0;
  if (!hasMap && pluginSource === undefined) {
    throw new Error('runTagInSandbox requires either pluginSource or envelope.moduleFiles');
  }
  const fullEnvelope: ContextEnvelope = hasMap
    ? { ...envelope, entryModuleKey: envelope.entryModuleKey ?? 'index.js' }
    : { ...envelope, moduleFiles: { 'index.js': pluginSource as string }, entryModuleKey: 'index.js' };

  try {
    // Polled during synchronous execution so a tight sync loop in plugin code can't bypass the timeout.
    ctx.runtime.setInterruptHandler(() => Date.now() > deadline);
    // Caps the WASM heap so a plugin can't OOM the host by allocating without bound.
    ctx.runtime.setMemoryLimit(32 * 1024 * 1024);
    // Discovery only ever evaluates plugin top-level code to read its exports — it must stay
    // side-effect-free even though that same top-level code can reach `__buildContext` (a bare
    // sandbox global, see SANDBOX_INTERNAL_GLOBALS) and wire up a context of its own. Swapping in a
    // rejecting bridge here means any such attempt fails inside the sandbox instead of reaching the
    // real host, no matter how it's invoked.
    installHostBridge(ctx, discover ? rejectingBridge : bridge, pendingBridgeCalls);
    installHostConsole(ctx, onConsole);
    installHostCrypto(ctx, opts.hostCrypto);

    // The envelope/tag globals are injected BEFORE the bootstrap, which captures them into closure
    // state and deletes the globals — so plugin top-level code can't rewrite grantedModules (or any
    // other envelope field) before __invoke() runs.
    setGlobalString(ctx, '__envelopeJSON', JSON.stringify(fullEnvelope));
    setGlobalString(ctx, '__tagName', tagName);
    evalOrThrow(ctx, IN_SANDBOX_BOOTSTRAP, '<sandbox-bootstrap>');
    // Ambient globals (Buffer/process/crypto/URL) depend on the bootstrap's encoders and the host
    // crypto functions, so they eval after the bootstrap and host installs. The non-sensitive
    // appInfo (platform/arch) is injected as its own global for the process stub to read + delete.
    setGlobalString(ctx, '__sandboxAppInfoJSON', JSON.stringify(envelope.appInfo ?? {}));
    evalOrThrow(ctx, SANDBOX_GLOBALS_SOURCE, '<sandbox-globals>');
    // Only register heavy vendored libs the plugin was granted, so unrelated renders don't parse them.
    evalOrThrow(ctx, buildModuleRegistrySource(fullEnvelope.grantedModules), '<sandbox-modules>');
    // Plugin source travels as envelope DATA (moduleFiles) and is compiled by the in-sandbox loader
    // when __invoke()/__describeExports()/__invokeHook() loads the entry — no host-side eval.
    const runner = envelope.actionKind
      ? ACTION_RUNNER
      : envelope.hookKind
        ? HOOK_RUNNER
        : discover
          ? DESCRIBE_RUNNER
          : RUNNER;
    evalOrThrow(ctx, runner, '<runner>');

    return await drivePromiseToString(ctx, timeoutMs, pendingBridgeCalls);
  } finally {
    forceSettlePendingBridgeCalls(ctx, pendingBridgeCalls);
    ctx.dispose();
  }
};

/** Installed instead of the real bridge during `discover: true` so a bridge call made from plugin top-level code fails inside the sandbox rather than reaching the host. */
const rejectingBridge: HostBridge = async path => {
  throw new Error(`Host bridge is unavailable during discovery (attempted call to "${path}")`);
};

/** Register `__hostBridge(path, bodyJson)` returning a VM promise resolved from async host work. */
const installHostBridge = (
  ctx: QuickJSContext,
  bridge: HostBridge,
  pending: Set<ReturnType<QuickJSContext['newPromise']>>,
): void => {
  const fn = ctx.newFunction('__hostBridge', (pathHandle, bodyHandle) => {
    const path = ctx.getString(pathHandle);
    let body: unknown;
    try {
      body = JSON.parse(ctx.getString(bodyHandle));
    } catch {
      body = {};
    }
    const deferred = ctx.newPromise();
    pending.add(deferred);
    Promise.resolve()
      .then(() => bridge(path, body))
      .then(
        value => settleBridgeResult(ctx, deferred, () => encodeBridgeSuccess(value)),
        err => settleBridgeResult(ctx, deferred, () => encodeBridgeFailure(err)),
      )
      .finally(() => pending.delete(deferred));
    // The settled VM promise schedules a job; pump it so the awaiting sandbox code resumes. Only if
    // the context is still around — forceSettlePendingBridgeCalls may have already settled (and the
    // finally above's real settlement above found) this same deferred after the context was disposed.
    deferred.settled.then(() => {
      if (ctx.alive) {
        ctx.runtime.executePendingJobs();
      }
    });
    return deferred.handle;
  });
  setGlobal(ctx, '__hostBridge', fn);
};

/**
 * Delivers a bridge result to the VM, tolerating two things that would otherwise escape as a
 * process-level unhandled rejection instead of a tag-visible error: the context having already been
 * disposed (the sandbox gave up on this render before the bridge call got a real response) and a
 * return value that isn't JSON-serializable (encode() throwing, e.g. on a circular reference).
 */
const settleBridgeResult = (
  ctx: QuickJSContext,
  deferred: ReturnType<QuickJSContext['newPromise']>,
  encode: () => string,
): void => {
  if (!ctx.alive || !deferred.alive) {
    return;
  }
  let json: string;
  try {
    json = encode();
  } catch (err) {
    json = encodeBridgeFailure(err);
  }
  resolveWithString(ctx, deferred, json);
};

/**
 * Forces any bridge call this render initiated but never got a real response to into a settled
 * state, then drains the resulting jobs. Without this, a bridge call still pending when the sandbox
 * gives up (e.g. on timeout) leaves a live promise/continuation referenced inside the context's
 * runtime — freeing that runtime (ctx.dispose(), below) then trips a fatal QuickJS engine assertion
 * instead of cleanly discarding the render. Loops (bounded) in case settling one call's continuation
 * synchronously starts another.
 */
const forceSettlePendingBridgeCalls = (
  ctx: QuickJSContext,
  pending: Set<ReturnType<QuickJSContext['newPromise']>>,
): void => {
  let guard = 0;
  while (pending.size > 0 && guard++ < 10) {
    const outstanding = Array.from(pending);
    pending.clear();
    for (const deferred of outstanding) {
      if (deferred.alive) {
        ctx.newError('Template tag sandbox disposed before this host bridge call settled').consume(deferred.reject);
      }
    }
    let rounds = 0;
    while (ctx.runtime.hasPendingJob() && rounds++ < 50) {
      ctx.runtime.executePendingJobs();
    }
  }
};

/**
 * Register synchronous crypto host functions. These return values inline (no VM promise), which is
 * what lets the in-sandbox `require('crypto')` shim be synchronous. Backed by the host's real crypto.
 */
const installHostCrypto = (ctx: QuickJSContext, hostCrypto?: HostCrypto): void => {
  if (!hostCrypto) {
    return;
  }
  const hashFn = ctx.newFunction('__cryptoHash', (algo, data, inEnc, outEnc) =>
    ctx.newString(
      hostCrypto.hash(ctx.getString(algo), ctx.getString(data), ctx.getString(inEnc), ctx.getString(outEnc)),
    ),
  );
  setGlobal(ctx, '__cryptoHash', hashFn);

  const hmacFn = ctx.newFunction('__cryptoHmac', (algo, key, data, outEnc) =>
    ctx.newString(hostCrypto.hmac(ctx.getString(algo), ctx.getString(key), ctx.getString(data), ctx.getString(outEnc))),
  );
  setGlobal(ctx, '__cryptoHmac', hmacFn);

  const randomBytesFn = ctx.newFunction('__cryptoRandomBytes', size => {
    // Clamp so a plugin can't force a multi-GB allocation (e.g. crypto.randomBytes(2 ** 31)).
    const clamped = Math.max(0, Math.min(Math.floor(ctx.getNumber(size)) || 0, 65_536));
    return ctx.newString(hostCrypto.randomBytes(clamped));
  });
  setGlobal(ctx, '__cryptoRandomBytes', randomBytesFn);

  const randomUUIDFn = ctx.newFunction('__cryptoRandomUUID', () => ctx.newString(hostCrypto.randomUUID()));
  setGlobal(ctx, '__cryptoRandomUUID', randomUUIDFn);
};

/** Register an optional `__hostConsole(level, message)` sink. */
const installHostConsole = (ctx: QuickJSContext, onConsole?: (level: string, message: string) => void): void => {
  if (!onConsole) {
    return;
  }
  const fn = ctx.newFunction('__hostConsole', (levelHandle, msgHandle) => {
    onConsole(ctx.getString(levelHandle), ctx.getString(msgHandle));
  });
  setGlobal(ctx, '__hostConsole', fn);
};

/**
 * Drive `globalThis.__task` (a VM promise) to completion, interleaving VM jobs with the host event
 * loop so pending bridge work can run, and marshal its resolved string out.
 */
const drivePromiseToString = async (
  ctx: QuickJSContext,
  timeoutMs: number,
  pendingBridgeCalls: Set<ReturnType<QuickJSContext['newPromise']>>,
): Promise<string> => {
  const taskHandle = ctx.getProp(ctx.global, '__task');
  const resultPromise = ctx.resolvePromise(taskHandle);
  taskHandle.dispose();

  let settled: Awaited<typeof resultPromise> | undefined;
  resultPromise.then(r => {
    settled = r;
  });

  const deadline = Date.now() + timeoutMs;
  while (!settled) {
    ctx.runtime.executePendingJobs();
    if (settled) {
      break;
    }
    if (Date.now() > deadline) {
      // __task may still be awaiting a bridge call that never got (or won't get in time) a real
      // response. Force it to a settled state and let that propagate before giving up — otherwise
      // __task's own promise/continuation, and the dup'd handle resolvePromise's reaction wraps it
      // in once it does settle, are both still live when the context is disposed, which crashes the
      // engine (see forceSettlePendingBridgeCalls). One extra microtask turn lets resultPromise's own
      // .then() above (which is how `settled` gets assigned) actually run.
      forceSettlePendingBridgeCalls(ctx, pendingBridgeCalls);
      await Promise.resolve();
      const forced = settled as Awaited<typeof resultPromise> | undefined;
      if (forced?.error) {
        forced.error.dispose();
      } else if (forced?.value) {
        forced.value.dispose();
      }
      throw new Error('Template tag sandbox timed out');
    }
    // Yield to the host loop so bridge promises settle and microtasks (incl. resultPromise) drain.
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (settled.error) {
    const errData = ctx.dump(settled.error);
    settled.error.dispose();
    throw toError(errData);
  }
  const result = ctx.getString(settled.value);
  settled.value.dispose();
  return result;
};

const resolveWithString = (
  ctx: QuickJSContext,
  deferred: ReturnType<QuickJSContext['newPromise']>,
  json: string,
): void => {
  const handle = ctx.newString(json);
  deferred.resolve(handle);
  handle.dispose();
};

const setGlobalString = (ctx: QuickJSContext, name: string, value: string): void => {
  const handle = ctx.newString(value);
  ctx.setProp(ctx.global, name, handle);
  handle.dispose();
};

const setGlobal = (ctx: QuickJSContext, name: string, handle: QuickJSHandle): void => {
  ctx.setProp(ctx.global, name, handle);
  handle.dispose();
};

const evalOrThrow = (ctx: QuickJSContext, code: string, filename: string): void => {
  const result = ctx.evalCode(code, filename);
  if (result.error) {
    const errData = ctx.dump(result.error);
    result.error.dispose();
    throw toError(errData);
  }
  result.value.dispose();
};

/** Rebuild a real Error from the dumped VM error so callers (e.g. translateLiquidError) see a normal Error. */
const toError = (data: unknown): Error => {
  if (data && typeof data === 'object' && 'message' in data) {
    const { message, name, stack, code, moduleName } = data as {
      message?: string;
      name?: string;
      stack?: string;
      code?: SandboxModuleDenialError['code'];
      moduleName?: string;
    };
    const err = new Error(message ?? 'Sandbox error');
    if (name) {
      err.name = name;
    }
    if (stack) {
      err.stack = stack;
    }
    if (code) {
      (err as SandboxModuleDenialError).code = code;
    }
    if (moduleName) {
      (err as SandboxModuleDenialError).moduleName = moduleName;
    }
    return err;
  }
  return new Error(typeof data === 'string' ? data : JSON.stringify(data));
};

/** Thrown by `__require` in the sandbox when a module is denied; `moduleName` is the requested specifier. */
export interface SandboxModuleDenialError extends Error {
  code: 'SANDBOX_MODULE_NOT_PERMITTED' | 'SANDBOX_MODULE_NOT_AVAILABLE';
  moduleName: string;
}
