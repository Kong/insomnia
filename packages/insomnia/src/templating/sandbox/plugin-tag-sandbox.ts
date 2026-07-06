import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';

import type { HostBridge } from './host-bridge';
import { IN_SANDBOX_BOOTSTRAP, RUNNER, wrapPluginSource } from './in-sandbox-bootstrap';
import { type ContextEnvelope, encodeBridgeFailure, encodeBridgeSuccess } from './marshal';

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
  /** Raw CommonJS source of the plugin module that exports `templateTags`. */
  pluginSource: string;
  /** Name of the tag within the module to execute. */
  tagName: string;
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
  const { pluginSource, tagName, envelope, bridge, onConsole, timeoutMs = 10_000 } = opts;
  const { getQuickJSModule } = await import('./quickjs-runtime');
  const QuickJS = await getQuickJSModule();
  const ctx = QuickJS.newContext();
  const deadline = Date.now() + timeoutMs;

  try {
    // Polled during synchronous execution so a tight sync loop in plugin code can't bypass the timeout.
    ctx.runtime.setInterruptHandler(() => Date.now() > deadline);
    // Caps the WASM heap so a plugin can't OOM the host by allocating without bound.
    ctx.runtime.setMemoryLimit(32 * 1024 * 1024);
    installHostBridge(ctx, bridge);
    installHostConsole(ctx, onConsole);
    installHostCrypto(ctx, opts.hostCrypto);

    evalOrThrow(ctx, IN_SANDBOX_BOOTSTRAP, '<sandbox-bootstrap>');
    setGlobalString(ctx, '__envelopeJSON', JSON.stringify(envelope));
    setGlobalString(ctx, '__tagName', tagName);
    evalOrThrow(ctx, wrapPluginSource(pluginSource), '<plugin>');
    evalOrThrow(ctx, RUNNER, '<runner>');

    return await drivePromiseToString(ctx, timeoutMs);
  } finally {
    ctx.dispose();
  }
};

/** Register `__hostBridge(path, bodyJson)` returning a VM promise resolved from async host work. */
const installHostBridge = (ctx: QuickJSContext, bridge: HostBridge): void => {
  const fn = ctx.newFunction('__hostBridge', (pathHandle, bodyHandle) => {
    const path = ctx.getString(pathHandle);
    let body: unknown;
    try {
      body = JSON.parse(ctx.getString(bodyHandle));
    } catch {
      body = {};
    }
    const deferred = ctx.newPromise();
    Promise.resolve()
      .then(() => bridge(path, body))
      .then(
        value => resolveWithString(ctx, deferred, encodeBridgeSuccess(value)),
        err => resolveWithString(ctx, deferred, encodeBridgeFailure(err)),
      );
    // The settled VM promise schedules a job; pump it so the awaiting sandbox code resumes.
    deferred.settled.then(() => ctx.runtime.executePendingJobs());
    return deferred.handle;
  });
  setGlobal(ctx, '__hostBridge', fn);
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
    ctx.newString(hostCrypto.hash(ctx.getString(algo), ctx.getString(data), ctx.getString(inEnc), ctx.getString(outEnc))),
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
const drivePromiseToString = async (ctx: QuickJSContext, timeoutMs: number): Promise<string> => {
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
    const { message, name, stack } = data as { message?: string; name?: string; stack?: string };
    const err = new Error(message ?? 'Sandbox error');
    if (name) {
      err.name = name;
    }
    if (stack) {
      err.stack = stack;
    }
    return err;
  }
  return new Error(typeof data === 'string' ? data : JSON.stringify(data));
};
