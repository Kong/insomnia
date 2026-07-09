import { getQuickJS, type QuickJSWASMModule } from 'quickjs-emscripten';

/**
 * Load the QuickJS WASM module once and share it. We use the *synchronous* variant deliberately:
 * the spike (PR #10072) found the asyncified variant breaks when user code awaits a host call
 * ("cannot handle error in suspended function"). Instead, host bridges return VM-native promises
 * that the orchestrator settles by pumping `executePendingJobs()` — no asyncify required.
 */
let modulePromise: Promise<QuickJSWASMModule> | null = null;

export const getQuickJSModule = (): Promise<QuickJSWASMModule> => {
  if (!modulePromise) {
    modulePromise = getQuickJS();
  }
  return modulePromise;
};
