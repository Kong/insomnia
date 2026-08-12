import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects/interfaces';
import type { WorkerResponse } from './quickjs-script.worker';

/**
 * Client side of the QuickJS-sandbox worker boundary. Runs a script by posting it to a dedicated
 * Web Worker (`quickjs-script.worker.ts`) instead of calling the engine (`quickjs-script-engine.ts`)
 * directly on the renderer's main thread — a runaway script blocks only that disposable worker, the
 * app stays responsive. The worker is created lazily on first use, since most users never enable
 * `settings.useQuickJsScriptSandbox` and shouldn't pay for a QuickJS-WASM load they never trigger.
 */

let worker: Worker | null = null;
const pending = new Map<string, { resolve: (value: RequestContext) => void; reject: (err: Error) => void }>();

const getWorker = (): Worker => {
  if (worker) {
    return worker;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see templating-handler.ts's identical pattern
  // @ts-ignore -- inso transpiles to commonjs so doesn't play nice with this
  const instance = new Worker(new URL('quickjs-script.worker.ts', import.meta.url), { type: 'module' });

  instance.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const { id } = event.data;
    const request = pending.get(id);
    if (!request) {
      return;
    }
    pending.delete(id);
    if ('error' in event.data) {
      const err = new Error(event.data.error.message);
      if (event.data.error.name) {
        err.name = event.data.error.name;
      }
      if (event.data.error.stack) {
        err.stack = event.data.error.stack;
      }
      request.reject(err);
    } else {
      request.resolve(event.data.result);
    }
  });

  // A crash in the worker's global scope (e.g. an unhandled rejection outside our own try/catch)
  // otherwise leaves every in-flight caller hanging forever. Reject them and drop the worker so the
  // next call gets a fresh one instead of reusing a dead thread.
  instance.addEventListener('error', event => {
    const err = new Error(`QuickJS sandbox worker crashed: ${event.message}`);
    pending.forEach(request => request.reject(err));
    pending.clear();
    if (worker === instance) {
      worker = null;
    }
  });

  worker = instance;
  return instance;
};

export const runScriptInQuickJs = ({
  script,
  context,
}: {
  script: string;
  context: RequestContext;
}): Promise<RequestContext> => {
  const id = `quickjs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<RequestContext>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, script, context });
  });
};
