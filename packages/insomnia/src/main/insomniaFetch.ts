import { BrowserWindow, net } from 'electron';

import { getApiBaseURL, getClientString } from '../common/constants';
import { delay } from '../common/misc';

interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET';
  path: string;
  sessionId: string | null;
  obj?: unknown;
  retries?: number;
}
// internal request (insomniaFetch)
// should validate ssl certs on our server
// should only go to insomnia API
// should be able to listen for specific messages in headers
// should be able to retry on 502

// external request (axiosRequest)
// should respect settings for proxy and ssl validation
// should be for all third party APIs, github, gitlab, isometric-git

const exponentialBackOff = async (url: string, init: RequestInit, retries = 0): Promise<Response> => {
  try {
    const response = await net.fetch(url, init);
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return exponentialBackOff(url, init, retries);
    }
    return response;
  } catch (err) {
    throw new Error(`Failed to fetch '${url}'`);
  }
};

export async function insomniaFetch<T = any>({ method, path, obj, sessionId, retries = 0 }: FetchConfig): Promise<T | string> {
  const config: RequestInit = {
    headers: {
      'X-Insomnia-Client': getClientString(),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(obj ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(obj ? { body: JSON.stringify(obj) } : {}),
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }
  const response = await exponentialBackOff(`${getApiBaseURL()}${path}`, config, retries);
  const uri = response.headers.get('x-insomnia-command');
  if (uri) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('shell:open', uri);
    }
  }
  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    // @ts-expect-error -- TSCONVERSION
    err.statusCode = response.status;
    throw err;
  }

  const isJson = response.headers.get('content-type') === 'application/json' || path.match(/\.json$/);
  return isJson ? response.json() : response.text();
}
