import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';

export interface RegisterProtocolOptions {
  scheme: string;
}

const insomniaStreamScheme = 'insomnia-event-source';
const httpsScheme = 'https';
const httpScheme = 'http';

// TTL cache for network requests
class NetworkCache {
  private cache: Record<string, { value: Response; timestamp: number }> = {};

  constructor(private ttl: number) { }

  async fetch(request: RequestInfo, options?: RequestInit & {
    bypassCustomProtocolHandlers?: boolean | undefined;
  }): Promise<Response> {
    const now = Date.now();

    let body = '';

    if (typeof request !== 'string') {
      body = await request.clone().text();
    }

    const key = JSON.stringify({ url: typeof request === 'string' ? request : request.url, body, options });

    if (this.cache[key] && now - this.cache[key].timestamp < this.ttl) {
      console.log('Using cached response');
      return this.cache[key].value.clone();
    }

    console.log('Fetching fresh response');
    const response = await net.fetch(request, options);
    this.cache[key] = { value: response.clone(), timestamp: now };
    return response.clone();
  }
}

const netCache = new NetworkCache(1000 * 30);

export async function registerInsomniaProtocols() {
  protocol.registerSchemesAsPrivileged([{
    scheme: insomniaStreamScheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  }, {
    scheme: httpsScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    }, {
    scheme: httpScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
  }]);

  await app.whenReady();

  if (!protocol.isProtocolHandled(insomniaStreamScheme)) {
    protocol.handle(insomniaStreamScheme, async request => {
      const apiURL = getApiBaseURL();
      const url = new URL(`${apiURL}/${request.url.replace(`${insomniaStreamScheme}://`, '')}`);
      const sessionId = new URLSearchParams(url.search).get('sessionId');
      request.headers.append('X-Session-Id', sessionId || '');
      return net.fetch(url.toString(), request);
    });
  }
  if (!protocol.isProtocolHandled(httpsScheme)) {
    protocol.handle(httpsScheme, async request => {
      const response = await netCache.fetch(request, { bypassCustomProtocolHandlers: true });

      return response;
    });
  }
  if (!protocol.isProtocolHandled(httpScheme)) {
    protocol.handle(httpScheme, async request => {
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
}
