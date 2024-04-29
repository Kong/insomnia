import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';
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
      const origin = request.headers.get('X-Origin') || getApiBaseURL();

      const path = request.url.replace(`${insomniaAPIScheme}://insomnia`, '');
      const url = new URL(path, origin);
      console.log('Fetching', url.toString());
      return net.fetch(url.toString(), request);
    });
  }
  if (!protocol.isProtocolHandled(externalScheme)) {
    protocol.handle(externalScheme, async request => {
      const path = request.url.replace(`${externalScheme}://insomnia/`, 'https://');
      const url = new URL(path);
      console.log('Fetching external', url.toString());
      return net.fetch(url.toString(), request);
    });
  }

}
