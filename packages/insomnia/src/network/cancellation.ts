import type { RequestContext } from 'insomnia-sdk';

import type { CurlRequestOptions, CurlRequestOutput } from '../main/network/libcurl-promise';
import type { CookieJar } from '../models/cookie-jar';
import type { Request } from '../models/request';
import { runScript as nodejsRunScript } from '../scriptExecutor';

const cancelRequestFunctionMap = new Map<string, () => void>();

export async function cancelRequestById(requestId: string) {
  window.main.completeExecutionStep({ requestId });
  const cancel = cancelRequestFunctionMap.get(requestId);
  if (cancel) {
    return cancel();
  }
  console.log(`[network] Failed to cancel req=${requestId} because cancel function not found`);
}

export const cancellableExecution = async (options: { id: string; fn: Promise<any> }) => {
  const controller = new AbortController();
  const cancelRequest = () => {
    // TODO: implement cancelPreRequestScript on hiddenBrowserWindow side?
    controller.abort();
  };
  cancelRequestFunctionMap.set(options.id, cancelRequest);

  try {
    return await cancellablePromise({
      signal: controller.signal,
      fn: options.fn,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    console.log('[network] Error', err);
    throw err;
  } finally {
    cancelRequestFunctionMap.delete(options.id);
  }
};

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
      fn: process.type === 'renderer' ? window.main.hiddenBrowserWindow.runScript(options) : nodejsRunScript(options),
    });

    return result as {
      request: Request;
      environment: object;
      baseEnvironment: object;
      cookieJar: CookieJar;
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    console.log('[network] Error', err);
    throw err;
  } finally {
    cancelRequestFunctionMap.delete(requestId);
  }
};

export const cancellableCurlRequest = async (requestOptions: CurlRequestOptions) => {
  const requestId = requestOptions.requestId;
  const controller = new AbortController();
  const cancelRequest = () => {
    window.main.cancelCurlRequest(requestId);
    controller.abort();
  };
  cancelRequestFunctionMap.set(requestId, cancelRequest);
  try {
    const result = await cancellablePromise({ signal: controller.signal, fn: window.main.curlRequest(requestOptions) });
    return result as CurlRequestOutput;
  } catch (err) {
    cancelRequestFunctionMap.delete(requestId);
    if (err.name === 'AbortError') {
      return { statusMessage: 'Cancelled', error: 'Request was cancelled' };
    }
    console.log('[network] Error', err);
    return { statusMessage: 'Error', error: err.message || 'Something went wrong' };
  }
};

export const cancellablePromise = ({ signal, fn }: { signal: AbortSignal; fn: Promise<any> }) => {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    fn.then(res => {
      resolve(res);
      signal?.removeEventListener('abort', abortHandler);
    }, reject);
    signal?.addEventListener('abort', abortHandler);
  });
};
