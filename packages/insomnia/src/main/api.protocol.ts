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

  protocol.handle(insomniaStreamScheme, async function (request) {
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

  console.log('REGISTERING INSOMNIA API PROTOCOL');

  await app.whenReady();

  if (protocol.isProtocolHandled(insomniaAPIScheme)) {
    return;
  }

  console.log('REGISTERING HANDLE FOR INSOMNIA API PROTOCOL');
  protocol.handle(insomniaAPIScheme, async function (request) {
    console.log('PROTOCOL HANDLED');
    const apiURL = getApiBaseURL();
    const url = new URL(`${apiURL}/${request.url.replace(`${insomniaAPIScheme}://`, '')}`);

    return net.fetch(url.toString(), request);
  });
}
