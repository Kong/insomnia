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
 * Not supported (throws inside the script if called): insomnia.sendRequest(), insomnia.test()/
 * pm.test(), collectionVariables, vault, cookies, client certificates, and mutating the request.
 */
export const runScriptInQuickJs = async ({
  script,
  context,
}: {
  script: string;
  context: RequestContext;
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

  try {
    // Polled during synchronous execution so a tight sync loop in the script can't bypass the timeout.
    vm.runtime.setInterruptHandler(() => Date.now() > deadline);
    vm.runtime.setMemoryLimit(32 * 1024 * 1024);

    installConsole(vm, scriptConsole);
    installKeyValueBridge(vm, '__envGet', '__envSet', environmentData);
    installKeyValueBridge(vm, '__varGet', '__varSet', variablesData);
    setGlobalString(vm, '__requestJSON', JSON.stringify(context.request ?? {}));

    evalOrThrow(vm, BOOTSTRAP, '<quickjs-script-bootstrap>');
    evalOrThrow(vm, wrapUserScript(script), '<user-script>');

    await driveTaskToCompletion(vm, deadline, timeoutMs);
  } finally {
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
  sendRequest: () => { throw new Error(${JSON.stringify(unsupportedApiMessage('insomnia.sendRequest()'))}); },
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
  result.value.dispose();
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
    vm.runtime.executePendingJobs();
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
  settled.value.dispose();
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
