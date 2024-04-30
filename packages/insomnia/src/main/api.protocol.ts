import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';
import { settings } from '../models';
import { setDefaultProtocol } from '../utils/url/protocol';
export interface RegisterProtocolOptions {
  scheme: string;
}

const insomniaStreamScheme = 'insomnia-event-source';
const insomniaAPIScheme = 'insomnia-api';
const externalScheme = 'external-api';

export async function registerInsomniaProtocols() {
  protocol.registerSchemesAsPrivileged([{
    scheme: insomniaStreamScheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  }, {
      scheme: insomniaAPIScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    }, {
      scheme: externalScheme,
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
  if (!protocol.isProtocolHandled(insomniaAPIScheme)) {
    protocol.handle(insomniaAPIScheme, async request => {
      let origin = request.headers.get('X-Origin') || getApiBaseURL();

      const { proxyEnabled, httpProxy, httpsProxy, noProxy } = await settings.get();

      const isHostnameExcludedFromProxy = noProxy.includes(new URL(origin).hostname);

      if (proxyEnabled && !isHostnameExcludedFromProxy) {
        const proxyUrl = origin.startsWith('https:') ? httpsProxy : httpProxy;

        const parsedURL = new URL(setDefaultProtocol(proxyUrl));

        origin = parsedURL.origin;
      }

      const path = request.url.replace(`${insomniaAPIScheme}://insomnia/`, '');

      const url = new URL(path, origin);

      console.log('Fetching', {
        incomingURL: request.url,
        path,
        origin,
        url,
        proxyEnabled,
        httpProxy,
        httpsProxy,
      });

      return net.fetch(url.toString(), request);
    });
  }
}
