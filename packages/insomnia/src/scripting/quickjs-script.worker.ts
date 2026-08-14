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
}

interface WorkerErrorResponse {
  id: string;
  error: { message: string; name?: string; stack?: string };
}

interface WorkerSuccessResponse {
  id: string;
  result: RequestContext;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, script, context } = event.data;
  try {
    const result = await runScriptInQuickJs({ script, context });
    self.postMessage({ id, result } satisfies WorkerSuccessResponse);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    self.postMessage({
      id,
      error: { message: error.message, name: error.name, stack: error.stack },
    } satisfies WorkerErrorResponse);
  }
};
