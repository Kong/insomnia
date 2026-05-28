// Node/CLI-only module. Loaded via require(/* @vite-ignore */ './run-script') in
// network.ts so the renderer Vite build never bundles this file.
import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects';
import { runScript as nodejsRunScript } from '../script-executor';

import { cancelRequestFunctionMap, cancellablePromise } from './cancellation';

export const cancellableRunScript = async (options: { script: string; context: RequestContext }) => {
  const request = options.context.request;
  const requestId = request._id;
  const controller = new AbortController();
  const cancelRequest = () => {
    // TODO: implement cancelPreRequestScript on hiddenBrowserWindow side?
    controller.abort();
  };
  cancelRequestFunctionMap.set(requestId, cancelRequest);
  try {
    const result = await cancellablePromise({
      signal: controller.signal,
      fn: nodejsRunScript(options),
    });

    return result;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    console.log('[network] Error', err);
    throw err;
  } finally {
    cancelRequestFunctionMap.delete(requestId);
  }
};
