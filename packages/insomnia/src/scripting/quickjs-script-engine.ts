import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';

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
 * KNOWN BUG (unresolved): a real sendRequest() round trip crashes under the real Electron/Worker
 * environment with `Aborted(Assertion failed: list_empty(&rt->gc_obj_list), at:
 * .../quickjs.c,2036,JS_FreeRuntime)` — see installSendRequestBridge's comment and
 * packages/insomnia-smoke-test/tests/smoke/quickjs-sendrequest-bridge.test.ts, which reproduces it.
 * Never reproduces in vitest (mocked fetch, or a real Node http server) — only real Electron fetch()
 * timing inside the dedicated Worker.
 *
 * Not supported (throws inside the script if called): insomnia.test()/pm.test(), collectionVariables,
 * vault, cookies, client certificates, and mutating the request.
 */
export const runScriptInQuickJs = async ({
  script,
  context,
  authToken,
}: {
  script: string;
  context: RequestContext;
  /** Auth token for the `insomnia-templating-worker-database://` bridge — required for sendRequest. */
  authToken?: string;
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

  // Set right after `vm.dispose()` below. The sendRequest bridge is a real async host round trip
  // (a `fetch()` to the Electron main process) whose resolution isn't driven by QuickJS's own job
  // queue the way in-VM promises are — checking this flag before ever touching `vm`/a promise
  // handle from that callback is what makes a late-arriving response after this function has
  // already returned (deadline/interrupt fired, or the caller otherwise moved on) a safe no-op
  // instead of a `QuickJSUseAfterFree` (or a native WASM abort disposing an in-use runtime).
  const disposedRef = { current: false };

  try {
    // Polled during synchronous execution so a tight sync loop in the script can't bypass the timeout.
    vm.runtime.setInterruptHandler(() => Date.now() > deadline);
    vm.runtime.setMemoryLimit(32 * 1024 * 1024);

    installConsole(vm, scriptConsole);
    installKeyValueBridge(vm, '__envGet', '__envSet', environmentData);
    installKeyValueBridge(vm, '__varGet', '__varSet', variablesData);
    installSendRequestBridge(vm, authToken, disposedRef);
    setGlobalString(vm, '__requestJSON', JSON.stringify(context.request ?? {}));

    evalOrThrow(vm, BOOTSTRAP, '<quickjs-script-bootstrap>');
    evalOrThrow(vm, wrapUserScript(script), '<user-script>');

    await driveTaskToCompletion(vm, deadline, timeoutMs);
  } finally {
    disposedRef.current = true;
    vm.dispose();
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
    const normalized = typeof request === 'string'
      ? { url: request, method: 'GET', headers: [] }
      : {
          url: request.url,
          method: request.method || 'GET',
          headers: Array.isArray(request.headers)
            ? request.headers
            : Object.entries(request.headers || {}).map(([name, value]) => ({ name, value: String(value) })),
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
        (err) => callback(err.message),
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
  const parsed = JSON.parse(await resp.text());
  if (!resp.ok) {
    throw new Error(typeof parsed?.error === 'string' ? parsed.error : `sendRequest failed with status ${resp.status}`);
  }
  return parsed;
};

/** Registers the async `__sendRequest(bodyJson)` bridge backing `insomnia.sendRequest()` in BOOTSTRAP. */
const installSendRequestBridge = (vm: QuickJSContext, authToken?: string, disposedRef?: { current: boolean }): void => {
  const fn = vm.newFunction('__sendRequest', bodyHandle => {
    const bodyJson = vm.getString(bodyHandle);
    const deferred = vm.newPromise();
    // `Promise.resolve().then(...)` defers the real fetch() call by one microtask tick so it never
    // runs while still nested inside this C-to-JS callback frame — matching host-bridge.ts's
    // installHostBridge (the proven-working equivalent for the template-tag sandbox). Calling the
    // async bridge function directly here instead (no extra tick) let its `await fetch(...)`
    // resolve while still on that native callback's call stack, which corrupted the WASM heap under
    // real Electron fetch() timing (reproduced as a `QuickJSUseAfterFree` / `gc_obj_list` abort on
    // `vm.newString` inside the resolution handler) — a reentrancy window neither a mocked fetch in
    // unit tests nor a plain Node http client ever hit, since both settle within the same tick.
    // NOTE: this deferral alone did NOT resolve the crash (see the module doc comment above) — kept
    // because it's still a real fix for the reentrancy hazard it targets, just not a sufficient one.
    Promise.resolve()
      .then(() => sendRequestViaFetch(bodyJson, authToken))
      .then(
        value => {
          if (!disposedRef?.current) {
            resolveDeferredWithString(vm, deferred, JSON.stringify({ ok: true, value }));
          }
        },
        err => {
          if (!disposedRef?.current) {
            resolveDeferredWithString(
              vm,
              deferred,
              JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
            );
          }
        },
      );
    // The settled VM promise schedules a job; pump it so the awaiting script resumes.
    deferred.settled.then(() => {
      if (!disposedRef?.current) {
        // executePendingJobs() returns a DisposableResult — on failure its `.error` is a live
        // QuickJSHandle. Discarding the result outright (as this used to) leaks that handle,
        // which is exactly what trips "gc_obj_list not empty" on a later vm.dispose().
        vm.runtime.executePendingJobs().dispose();
      }
    });
    return deferred.handle;
  });
  setGlobal(vm, '__sendRequest', fn);
};

const resolveDeferredWithString = (
  vm: QuickJSContext,
  deferred: ReturnType<QuickJSContext['newPromise']>,
  value: string,
): void => {
  const handle = vm.newString(value);
  deferred.resolve(handle);
  handle.dispose();
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
