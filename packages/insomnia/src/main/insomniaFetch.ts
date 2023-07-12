import { BrowserWindow, net } from 'electron';

import { getApiBaseURL, getClientString } from '../common/constants';
import { delay } from '../common/misc';

interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET';
  path: string;
  sessionId: string | null;
  data?: unknown;
  retries?: number;
  origin?: string;
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
    if (!response.ok) {
      console.log(`Response not OK: ${response.status} for ${url}`);
    }
    return response;
  } catch (err) {
    throw err;
  }
};

export async function insomniaFetch<T = any>({ method, path, data, sessionId, origin }: FetchConfig): Promise<T> {
  const config: RequestInit = {
    method,
    headers: {
      'X-Insomnia-Client': getClientString(),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }
  const response = await exponentialBackOff(`${origin || getApiBaseURL()}${path}`, config);
  const uri = response.headers.get('x-insomnia-command');
  if (uri) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('shell:open', uri);
    }
  }
  const isJson = response.headers.get('content-type') === 'application/json' || path.match(/\.json$/);
  return isJson ? response.json() : response.text();
}
