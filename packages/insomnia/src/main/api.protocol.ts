import { app, net, protocol } from 'electron';

import { getApiBaseURL } from '../common/constants';
import { settings } from '../models';
export interface RegisterProtocolOptions {
  scheme: string;
}

const scheme = 'insomnia-event-source';

export async function registerInsomniaStreamProtocol() {
  protocol.registerSchemesAsPrivileged([{
    scheme,
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  }]);

  await app.whenReady();

  if (protocol.isProtocolHandled(scheme)) {
    return;
  }

  protocol.handle(scheme, async function(request) {
    const { dev } = await settings.get();
    const apiURL = dev?.servers.api || getApiBaseURL();
    const url = new URL(`${apiURL}/${request.url.replace(`${scheme}://`, '')}`);
    const sessionId = new URLSearchParams(url.search).get('sessionId');
    request.headers.append('X-Session-Id', sessionId || '');

    return net.fetch(url.toString(), request);
  });
}
