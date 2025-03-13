import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';

export interface RegisterProtocolOptions {
  scheme: string;
}

const insomniaStreamScheme = 'insomnia-event-source';
const httpsScheme = 'https';
const httpScheme = 'http';

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
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
  if (!protocol.isProtocolHandled(httpScheme)) {
    protocol.handle(httpScheme, async request => {
      return net.fetch(request, { bypassCustomProtocolHandlers: true });
    });
  }
}
