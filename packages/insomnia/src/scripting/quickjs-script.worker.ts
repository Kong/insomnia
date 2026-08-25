import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import { runScriptInQuickJs } from './quickjs-script-engine';

/**
 * Web Worker entry point for the QuickJS script engine — moves execution off the renderer's main
 * thread (see `run-script-quickjs.ts`, this worker's client), so a runaway script blocks only this
 * disposable worker, never the UI. One message in, one response out; no persistent VM state is kept
 * between messages (`quickjs-script-engine.ts` creates and disposes a fresh QuickJS context per call).
 */

interface WorkerRequest {
  id: string;
  script: string;
  context: RequestContext;
  /** Forwarded by `run-script-quickjs.ts`; a Worker can't reach `window.main` to fetch it itself. */
  authToken?: string;
}

/**
 * `engineFaulted` asks the client to retire this worker — the WASM module aborted while tearing a
 * context down, so the module it caches is not one we want to keep running scripts on. Set on both
 * response shapes because the fault is independent of whether the script itself succeeded.
 */
interface WorkerErrorResponse {
  id: string;
  error: { message: string; name?: string; stack?: string };
  engineFaulted?: boolean;
}

interface WorkerSuccessResponse {
  id: string;
  result: RequestContext;
  engineFaulted?: boolean;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, script, context, authToken } = event.data;
  let engineFaulted = false;
  try {
    const result = await runScriptInQuickJs({
      script,
      context,
      authToken,
      onEngineFault: () => {
        engineFaulted = true;
      },
    });
    self.postMessage({ id, result, engineFaulted } satisfies WorkerSuccessResponse);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    self.postMessage({
      id,
      error: { message: error.message, name: error.name, stack: error.stack },
      engineFaulted,
    } satisfies WorkerErrorResponse);
  }
};
