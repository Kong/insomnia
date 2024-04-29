import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';
export interface RegisterProtocolOptions {
  scheme: string;
}

const insomniaStreamScheme = 'insomnia-event-source';

export async function registerInsomniaStreamProtocol() {
  protocol.registerSchemesAsPrivileged([{
    scheme: insomniaStreamScheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  }]);

  await app.whenReady();

  if (protocol.isProtocolHandled(insomniaStreamScheme)) {
    return;
  }

  protocol.handle(insomniaStreamScheme, async request => {
    const apiURL = getApiBaseURL();
    const url = new URL(`${apiURL}/${request.url.replace(`${insomniaStreamScheme}://`, '')}`);
    const sessionId = new URLSearchParams(url.search).get('sessionId');
    request.headers.append('X-Session-Id', sessionId || '');

    return net.fetch(url.toString(), request);
  });
}

const insomniaAPIScheme = 'insomnia-api';

export async function registerInsomniaAPIProtocol() {
  protocol.registerSchemesAsPrivileged([{
    scheme: insomniaAPIScheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  }]);

  await app.whenReady();

  if (protocol.isProtocolHandled(insomniaAPIScheme)) {
    return;
  }

  protocol.handle(insomniaAPIScheme, async request => {
    const origin = request.headers.get('X-Origin') || getApiBaseURL();
    const path = request.url.replace(`${insomniaAPIScheme}://insomnia/`, '');
    const url = new URL(path, origin);
    console.log('Fetching', url.toString());
    return net.fetch(url.toString(), request);
  });
}
