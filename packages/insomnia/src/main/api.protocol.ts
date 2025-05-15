import { Readable } from 'node:stream';

import { Curl, CurlAuth, CurlFeature, CurlSslOpt, type HeaderInfo } from '@getinsomnia/node-libcurl';
import { app, net, protocol } from 'electron';
import { parse as urlParse } from 'url';

import { getApiBaseURL } from '../common/constants';
import { get as getSettings } from '../models/settings';
import * as _userSession from '../models/user-session';
import { setDefaultProtocol } from './network/libcurl-promise';
import { resolveDbByKey } from './templating-worker-database';

export interface RegisterProtocolOptions {
  scheme: string;
}

const insomniaStreamScheme = 'insomnia-event-source';
const httpsScheme = 'https';
const httpScheme = 'http';
const templatingWorkerDatabaseInterface = 'insomnia-templating-worker-database';

export async function registerInsomniaProtocols() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: insomniaStreamScheme,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: httpsScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    },
    {
      scheme: httpScheme,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    },
    {
      scheme: templatingWorkerDatabaseInterface,
      privileges: { secure: true, standard: true, supportFetchAPI: true },
    },
  ]);

  await app.whenReady();

  if (!protocol.isProtocolHandled(insomniaStreamScheme)) {
    protocol.handle(insomniaStreamScheme, async originalRequest => {
      const settings = await getSettings();
      // here we use libcurl to forward the SSE request because the SSE request sent by net.fetch can not be disconnected correctly in some cases
      return await new Promise((resolve, reject) => {
        try {
          const apiURL = getApiBaseURL();
          const url = new URL(`${apiURL}/${originalRequest.url.replace(`${insomniaStreamScheme}://`, '')}`);
          const urlStr = url.toString();

          const sessionId = new URLSearchParams(url.search).get('sessionId');

          const curl = new Curl();
          curl.setOpt(Curl.option.URL, urlStr);
          curl.setOpt(Curl.option.ACCEPT_ENCODING, '');
          curl.setOpt(Curl.option.SSL_OPTIONS, CurlSslOpt.NativeCa);

          if (!settings.proxyEnabled) {
            curl.setOpt(Curl.option.PROXY, '');
          } else {
            const { protocol } = urlParse(urlStr);
            const { httpProxy, httpsProxy, noProxy } = settings;
            const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
            const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
            if (proxy) {
              curl.setOpt(Curl.option.PROXY, proxy);
              curl.setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
            }
            if (noProxy) {
              curl.setOpt(Curl.option.NOPROXY, noProxy);
            }
          }

          curl.setOpt(Curl.option.TIMEOUT_MS, 0);
          curl.setOpt(Curl.option.FOLLOWLOCATION, true);
          curl.enable(CurlFeature.StreamResponse);
          curl.setOpt(Curl.option.HTTPHEADER, [
            ...Array.from(originalRequest.headers.entries()).map(([key, value]) => `${key}: ${value}`),
            `X-Session-Id: ${sessionId || ''}`,
          ]);

          curl.on('error', () => {
            curl.close();
          });

          curl.on('end', () => {
            curl.close();
          });

          curl.on('stream', async (stream: Readable, _code: number, [headersWithStatus]: HeaderInfo[]) => {
            const { result, ...headers } = headersWithStatus;
            resolve(
              new Response(Readable.toWeb(stream) as ReadableStream, {
                status: _code,
                statusText: result?.reason,
                headers: headers,
              }),
            );
          });

          curl.perform();
        } catch (err) {
          reject(err);
        }
      });
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
  if (!protocol.isProtocolHandled(templatingWorkerDatabaseInterface)) {
    protocol.handle(templatingWorkerDatabaseInterface, resolveDbByKey);
  }
}
