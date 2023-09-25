import { BrowserWindow, net } from 'electron';

import { getApiBaseURL, getClientString } from '../common/constants';
import { delay } from '../common/misc';

interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE' | 'PATCH';
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
      await delay(retries * 1000);
      console.log(`Received 502 from ${url} retrying`);
      return exponentialBackOff(url, init, retries);
    }
    if (!response.ok) {
      // TODO: review error status code behaviour with backend, should we parse errors here and return response
      // or should we rethrow an error with a response object inside? should we be exposing errors to the app UI?
      console.log(`Response not OK: ${response.status} for ${url}`);
    }
    return response;
  } catch (err) {
    throw err;
  }
};

export async function insomniaFetch<T = void>({ method, path, data, sessionId, origin }: FetchConfig): Promise<T> {
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

  const apiURL = getApiBaseURL();
  const response = await exponentialBackOff(`${origin || apiURL}${path}`, config);
  const uri = response.headers.get('x-insomnia-command');
  if (uri) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('shell:open', uri);
    }
  }
  const isJson = response.headers.get('content-type')?.includes('application/json') || path.match(/\.json$/);
  return isJson ? response.json() : response.text();
}
