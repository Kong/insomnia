import { app, net, protocol } from 'electron';
import { session } from 'electron/main';

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
      const origin = request.headers.get('X-Origin') || getApiBaseURL();

      // Update the proxy settings before making the request.
      // @TODO this could run on a db.onChange event to avoid running it on every request.
      async function updateProxy() {
        const { proxyEnabled, httpProxy, httpsProxy, noProxy } = await settings.get();

        const isHostnameExcludedFromProxy = noProxy.includes(new URL(origin).hostname);

        if (proxyEnabled && !isHostnameExcludedFromProxy) {
          // Supported values for proxyUrl are like: http://localhost:8888, https://localhost:8888 or localhost:8888
          // This function tries to parse the proxyUrl and return the hostname in order to allow all the above values to work.
          function parseProxyFromUrl(proxyUrl: string) {
            const url = new URL(setDefaultProtocol(proxyUrl));
            return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
          }

          const proxyRules = [];

          if (httpProxy) {
            proxyRules.push(`http=${parseProxyFromUrl(httpProxy)}`);
          }

          if (httpsProxy) {
            proxyRules.push(`https=${parseProxyFromUrl(httpsProxy)}`);
          }

          // Set proxy rules in the main session https://www.electronjs.org/docs/latest/api/structures/proxy-config
          session.defaultSession.setProxy({
            proxyRules: proxyRules.join(';'),
            proxyBypassRules: [
              noProxy,
              // getApiBaseURL(),
              // @TODO Add all our API urls here to bypass the proxy to work as before with axios.
              // We can add an option in settings to use the proxy for insomnia API requests and not include them here.
            ].join(','),
          });
        }
      }

      updateProxy();

      const path = request.url.replace(`${insomniaAPIScheme}://insomnia/`, '');

      const url = new URL(path, origin);

      console.log('Fetching', {
        incomingURL: request.url,
        path,
        origin,
        url,
      });

      return net.fetch(url.toString(), request);
    });
  }
}
