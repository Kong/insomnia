import type { QuickJSContext, QuickJSDeferredPromise, QuickJSHandle } from 'quickjs-emscripten';

import { Console } from '../../../insomnia-scripting-environment/src/objects/console';
import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import { getQuickJSModule } from '../templating/sandbox/quickjs-runtime';

/**
 * The actual QuickJS execution engine — creates a fresh VM, bridges in the minimal API surface, runs
 * the script, and tears the VM down. Runs wherever it's called from (today: inside
 * `quickjs-script.worker.ts`, off the renderer's main thread — see `run-script-quickjs.ts` for the
 * client side of that boundary). Has no knowledge of workers/messaging; callers own that.
 *
 * PoC/experimental alternative to `run-script.ts`'s hidden-`BrowserWindow` execution path. Only a
 * minimal API surface is bridged in — enough to demonstrate the architecture, not enough to replace
 * the hidden-window sandbox yet. Gated behind `settings.useQuickJsScriptSandbox` (default off).
 *
 * insomnia.sendRequest() bridges to the real `network.sendRequestWithoutSideEffects` host handler
 * (the same one the template-tag sandbox uses) over the `insomnia-templating-worker-database://`
 * fetch-based protocol — see `installSendRequestBridge` below. It supports only a minimal request
 * shape (a URL string, or `{ url, method, headers, body }` with a plain string body) — no auth,
 * client certificates, cookies, or multipart/urlencoded bodies yet, and the response object exposes
 * only `code`/`status`/`headers`/`body`/`responseTime`/`json()`/`text()` (no chai assertions, no
 * `originalRequest`). Full parity with the hidden-window `Response` class is deferred.
 *
 * Not supported (throws inside the script if called): insomnia.test()/pm.test(), collectionVariables,
 * vault, cookies, client certificates, and mutating the request.
 */
export const runScriptInQuickJs = async ({
  script,
  context,
  authToken,
  onEngineFault,
}: {
  script: string;
  context: RequestContext;
  /** Auth token for the `insomnia-templating-worker-database://` bridge — required for sendRequest. */
  authToken?: string;
  /**
   * Called when tearing the VM down aborts the WASM module — see `ENGINE_FAULT_MESSAGE`. The script
   * itself already finished, so the run still returns its result; this is the signal to replace the
   * engine rather than keep using a module that has aborted. Always fires when it happens, including
   * on the error/timeout path.
   */
  onEngineFault?: (error: Error) => void;
}): Promise<RequestContext> => {
  const QuickJS = await getQuickJSModule();
  const vm = QuickJS.newContext();
  const scriptConsole = new Console();
  const timeoutMs = context.settings.timeout && context.settings.timeout > 0 ? context.settings.timeout : 30_000;
  const deadline = Date.now() + timeoutMs;

  // Copied in up front and mutated in place by the environment/variables bridges below; whatever
  // is left in these objects when the script finishes becomes the updated context.
  const environmentData: Record<string, unknown> = { ...context.environment.data };
  const variablesData: Record<string, unknown> = { ...context.transientVariables?.data };

  // Every VM promise handed to the script by `installSendRequestBridge` that hasn't settled yet.
  // Each one owns three JSValues — the promise plus its `resolve`/`reject` functions — and
  // quickjs-emscripten only frees the two functions from inside `resolve()`/`reject()`. A VM
  // promise still pending when the runtime is freed therefore leaks two live function objects,
  // which trips QuickJS's `assert(list_empty(&rt->gc_obj_list))` in `JS_FreeRuntime`: a native
  // Emscripten abort rather than a catchable error, so it takes the script worker down instead of
  // surfacing as a script failure. `finally` below settles this set before disposing.
  const pendingDeferreds = new Set<QuickJSDeferredPromise>();

  try {
    // Polled during synchronous execution so a tight sync loop in the script can't bypass the timeout.
    vm.runtime.setInterruptHandler(() => Date.now() > deadline);
    vm.runtime.setMemoryLimit(32 * 1024 * 1024);

    installConsole(vm, scriptConsole);
    installKeyValueBridge(vm, '__envGet', '__envSet', environmentData);
    installKeyValueBridge(vm, '__varGet', '__varSet', variablesData);
    installSendRequestBridge(vm, pendingDeferreds, authToken);
    setGlobalString(vm, '__requestJSON', JSON.stringify(context.request ?? {}));

    evalOrThrow(vm, BOOTSTRAP, '<quickjs-script-bootstrap>');
    evalOrThrow(vm, wrapUserScript(script), '<user-script>');

    await driveTaskToCompletion(vm, deadline, timeoutMs);
  } finally {
    // Ordering matters: free the resolve/reject functions of anything still in flight (a script
    // that never awaited its sendRequest, or a run that hit the deadline mid-request) *before*
    // the runtime, or `JS_FreeRuntime` aborts. `dispose()` is documented as idempotent, so
    // already-settled deferreds still in the set are harmless.
    pendingDeferreds.forEach(deferred => deferred.dispose());
    pendingDeferreds.clear();
    try {
      vm.dispose();
    } catch (err) {
      // A known defect in quickjs-emscripten's WASM build (upstream issue #269) aborts the module
      // here when the script allocated heavily after its first `await` — see ENGINE_FAULT_MESSAGE.
      // The script has already run and everything we return is plain host-side JS, so swallowing
      // this yields a complete result instead of destroying the run. Catching inside `finally` also
      // means a genuine script error or timeout from the `try` above still wins.
      const fault = err instanceof Error ? err : new Error(String(err));
      scriptConsole.warn(ENGINE_FAULT_MESSAGE, fault.message);
      onEngineFault?.(fault);
    }
  }

  return {
    ...context,
    environment: {
      id: context.environment.id,
      name: context.environment.name,
      data: environmentData,
    },
    transientVariables: {
      name: context.transientVariables?.name || 'transientVariables',
      data: variablesData,
    },
    logs: scriptConsole.dumpLogsAsArray(),
  };
};

/**
 * Prefixes the warning a script sees when its run tripped the known WASM-build abort.
 *
 * Allocating ~100k+ objects after the script's first `await` — which a multi-megabyte
 * `insomnia.sendRequest()` response body does on its own — leaves QuickJS's runtime un-freeable, and
 * `JS_FreeRuntime` then aborts on `assert(list_empty(&rt->gc_obj_list))`. The same allocation done
 * synchronously is fine at several times the size. It is a defect in quickjs-emscripten's *WASM
 * build* rather than in QuickJS: the identical vendored engine source, built natively, is clean well
 * past the failing size at every optimization level. Tracked upstream as
 * https://github.com/justjake/quickjs-emscripten/issues/269.
 */
const ENGINE_FAULT_MESSAGE =
  'The QuickJS engine faulted while cleaning up after this script, a known issue with large amounts of data handled after an await. The script finished and its results are intact; the engine will be replaced before the next run.';

const unsupportedApiMessage = (name: string): string =>
  `${name} is not supported yet by the QuickJS sandbox (proof of concept). Disable "Use QuickJS sandbox for scripts" in Settings > Scripting to use it.`;

const BOOTSTRAP = `
globalThis.insomnia = {
  environment: {
    get: (key) => JSON.parse(__envGet(key)),
    set: (key, value) => { __envSet(key, JSON.stringify(value === undefined ? null : value)); },
  },
  variables: {
    get: (key) => JSON.parse(__varGet(key)),
    set: (key, value) => { __varSet(key, JSON.stringify(value === undefined ? null : value)); },
  },
  request: (function deepFreeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(deepFreeze);
      return Object.freeze(value);
    }
    return value;
  })(JSON.parse(__requestJSON)),
  sendRequest: (request, callback) => {
    const normalizeHeaders = (raw) => {
      if (Array.isArray(raw)) {
        // Scripting-environment RequestOptions.header entries use {key, value}; accept {name, value}
        // too since that's the shape the bridge itself (and the hidden-window Response) already uses.
        return raw.map((h) => ({ name: h.name ?? h.key, value: String(h.value) }));
      }
      if (raw && typeof raw === 'object') {
        return Object.entries(raw).map(([name, value]) => ({ name, value: String(value) }));
      }
      return [];
    };
    const normalized = typeof request === 'string'
      ? { url: request, method: 'GET', headers: [] }
      : {
          // request.url may be a Url-like object (per RequestOptions); the host handler needs a string.
          url: String(request.url),
          method: request.method || 'GET',
          // RequestOptions calls this field "header" (singular); accept the plural too.
          headers: normalizeHeaders(request.headers ?? request.header),
          body: request.body !== undefined ? { mimeType: 'text/plain', text: String(request.body) } : undefined,
        };
    const bodyJson = JSON.stringify({ options: { request: normalized, caCertficatePath: null } });
    const promise = __sendRequest(bodyJson).then((envelopeJson) => {
      const envelope = JSON.parse(envelopeJson);
      if (!envelope.ok) {
        throw new Error(envelope.error);
      }
      const result = envelope.value;
      return {
        code: result.code,
        status: result.status,
        headers: result.headers,
        body: result.body,
        responseTime: result.responseTime,
        json: () => JSON.parse(result.body),
        text: () => result.body,
      };
    });
    if (typeof callback === 'function') {
      promise.then(
        (response) => callback(undefined, response),
        (err) => callback(err && err.message ? err.message : String(err)),
      );
      return undefined;
    }
    return promise;
  },
  test: () => { throw new Error(${JSON.stringify(unsupportedApiMessage('insomnia.test()/pm.test()'))}); },
};
globalThis.$ = globalThis.insomnia;
`;

const wrapUserScript = (script: string): string => `
globalThis.__task = (async () => {
  ${script}
})();
`;

const installConsole = (vm: QuickJSContext, scriptConsole: Console): void => {
  const consoleHandle = vm.newObject();
  (['log', 'warn', 'error', 'info', 'debug'] as const).forEach(level => {
    const fn = vm.newFunction(level, (...argHandles: QuickJSHandle[]) => {
      const values = argHandles.map(handle => vm.dump(handle));
      scriptConsole[level](...values);
    });
    vm.setProp(consoleHandle, level, fn);
    fn.dispose();
  });
  vm.setProp(vm.global, 'console', consoleHandle);
  consoleHandle.dispose();
};

// Using one of these as a bracket-assignment key on a plain object rewires its prototype or
// shadows the name instead of setting an ordinary property.
const DANGEROUS_BRIDGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// The same fetch-based bridge the template-tag sandbox uses (`common/templating/liquid-extension-worker.ts`),
// reused here rather than adding a second protocol scheme — this endpoint already sends a real
// request via curl without persisting it to request/response history, which is exactly what an
// ad-hoc `insomnia.sendRequest()` call needs.
const SEND_REQUEST_ENDPOINT = 'insomnia-templating-worker-database://network.sendrequestwithoutsideeffects';
const TEMPLATING_DB_AUTH_HEADER = 'x-insomnia-templating-auth';

const sendRequestViaFetch = async (requestBodyJson: string, authToken?: string): Promise<Record<string, unknown>> => {
  const resp = await fetch(SEND_REQUEST_ENDPOINT, {
    method: 'post',
    headers: authToken ? { [TEMPLATING_DB_AUTH_HEADER]: authToken } : undefined,
    body: requestBodyJson,
  });
  const text = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A non-JSON body (e.g. an empty response, or an HTML error page from something in front of the
    // protocol handler) would otherwise surface as an opaque SyntaxError that masks the real status.
    throw new Error(
      resp.ok
        ? `sendRequest received a non-JSON response: ${text.slice(0, 200)}`
        : `sendRequest failed with status ${resp.status}`,
    );
  }
  if (!resp.ok) {
    const errorMessage =
      typeof (parsed as { error?: unknown })?.error === 'string'
        ? (parsed as { error: string }).error
        : `sendRequest failed with status ${resp.status}`;
    throw new Error(errorMessage);
  }
  return parsed as Record<string, unknown>;
};

/** Registers the async `__sendRequest(bodyJson)` bridge backing `insomnia.sendRequest()` in BOOTSTRAP. */
const installSendRequestBridge = (
  vm: QuickJSContext,
  pendingDeferreds: Set<QuickJSDeferredPromise>,
  authToken?: string,
): void => {
  const fn = vm.newFunction('__sendRequest', bodyHandle => {
    const bodyJson = vm.getString(bodyHandle);
    const deferred = vm.newPromise();
    // Registered so the run's `finally` can free this deferred's resolve/reject functions if the
    // fetch is still outstanding when the VM is torn down — see `pendingDeferreds`' comment.
    pendingDeferreds.add(deferred);
    // `Promise.resolve().then(...)` defers the real fetch() call by one microtask tick so it never
    // runs while still nested inside this C-to-JS callback frame — matching plugin-tag-sandbox.ts's
    // installHostBridge, the proven-working equivalent for the template-tag sandbox.
    Promise.resolve()
      .then(() => sendRequestViaFetch(bodyJson, authToken))
      .then(
        value => settle(vm, deferred, pendingDeferreds, JSON.stringify({ ok: true, value })),
        err =>
          settle(
            vm,
            deferred,
            pendingDeferreds,
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          ),
      );
    // The settled VM promise schedules a job; pump it so the awaiting script resumes.
    deferred.settled.then(() => {
      if (vm.alive) {
        // executePendingJobs() returns a DisposableResult — on failure its `.error` is a live
        // QuickJSHandle that leaks if the result is discarded rather than disposed.
        vm.runtime.executePendingJobs().dispose();
      }
    });
    return deferred.handle;
  });
  setGlobal(vm, '__sendRequest', fn);
};

/**
 * Resolve a bridge deferred with a JSON payload, if the VM is still around to receive it.
 *
 * A `fetch()` can land after the run has finished (the script never awaited it, or the deadline
 * fired first), by which point the VM is gone: `vm.newString` on a disposed context throws
 * `QuickJSUseAfterFree` synchronously inside this `.then`, i.e. an unhandled rejection in the
 * worker. `deferred.alive` covers the narrower case of a deferred already force-disposed by the
 * run's `finally` while the context itself is somehow still up.
 */
const settle = (
  vm: QuickJSContext,
  deferred: QuickJSDeferredPromise,
  pendingDeferreds: Set<QuickJSDeferredPromise>,
  value: string,
): void => {
  if (!vm.alive || !deferred.alive) {
    return;
  }
  const handle = vm.newString(value);
  deferred.resolve(handle);
  handle.dispose();
  pendingDeferreds.delete(deferred);
};

/** Registers `<getName>(key)`/`<setName>(key, jsonValue)` host functions backed by a plain object. */
const installKeyValueBridge = (
  vm: QuickJSContext,
  getName: string,
  setName: string,
  store: Record<string, unknown>,
): void => {
  const getFn = vm.newFunction(getName, keyHandle => {
    const key = vm.getString(keyHandle);
    const value = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    return vm.newString(JSON.stringify(value));
  });
  setGlobal(vm, getName, getFn);

  const setFn = vm.newFunction(setName, (keyHandle, valueHandle) => {
    const key = vm.getString(keyHandle);
    if (DANGEROUS_BRIDGE_KEYS.has(key)) {
      return;
    }
    const rawValue = vm.getString(valueHandle);
    try {
      store[key] = JSON.parse(rawValue);
    } catch {
      store[key] = rawValue;
    }
  });
  setGlobal(vm, setName, setFn);
};

const setGlobal = (vm: QuickJSContext, name: string, handle: QuickJSHandle): void => {
  // setProp does NOT take ownership of handle — it must still be disposed here, or the VM leaks
  // it and asserts ("gc_obj_list" non-empty) when the runtime is later disposed.
  vm.setProp(vm.global, name, handle);
  handle.dispose();
};

const setGlobalString = (vm: QuickJSContext, name: string, value: string): void => {
  const handle = vm.newString(value);
  setGlobal(vm, name, handle);
};

const evalOrThrow = (vm: QuickJSContext, code: string, filename: string): void => {
  const result = vm.evalCode(code, filename);
  if (result.error) {
    const errData = vm.dump(result.error);
    result.error.dispose();
    throw toError(errData);
  }
  if ('value' in result) {
    result.value.dispose();
  }
};

/** Drives `globalThis.__task` (a VM promise wrapping the user script) to completion. */
const driveTaskToCompletion = async (vm: QuickJSContext, deadline: number, timeoutMs: number): Promise<void> => {
  const taskHandle = vm.getProp(vm.global, '__task');
  const resultPromise = vm.resolvePromise(taskHandle);
  taskHandle.dispose();

  let settled: Awaited<typeof resultPromise> | undefined;
  resultPromise.then(result => {
    settled = result;
  });

  while (!settled) {
    // See installSendRequestBridge's identical call for why the result must be disposed, not
    // discarded: on failure its `.error` is a live QuickJSHandle that otherwise leaks.
    vm.runtime.executePendingJobs().dispose();
    if (settled) {
      break;
    }
    if (Date.now() > deadline) {
      throw new Error(`Executing script timeout: ${timeoutMs}`);
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (settled.error) {
    const errData = vm.dump(settled.error);
    settled.error.dispose();
    throw toError(errData);
  }
  if ('value' in settled) {
    settled.value.dispose();
  }
};

const toError = (data: unknown): Error => {
  if (data && typeof data === 'object' && 'message' in data) {
    const { message, name, stack } = data as { message?: string; name?: string; stack?: string };
    const err = new Error(message ?? 'QuickJS sandbox error');
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
