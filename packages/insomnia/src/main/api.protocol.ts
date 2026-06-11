import path from 'node:path';
import { Readable } from 'node:stream';
import { parse as urlParse } from 'node:url';

import { Curl, CurlAuth, CurlFeature, CurlProxy, CurlSslOpt, type HeaderInfo } from '@getinsomnia/node-libcurl';
import { app, net, protocol, session } from 'electron';
import { services } from 'insomnia-data';

import { getApiBaseURL } from '../common/constants';
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
      const apiURL = getApiBaseURL();
      const url = new URL(`${apiURL}/${originalRequest.url.replace(`${insomniaStreamScheme}://`, '')}`);
      const urlStr = url.toString();
      const settings = await services.settings.get();
      // systemProxy follows the PAC return value format.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file#return_value_format
      let systemProxyStr = await session.defaultSession.resolveProxy(urlStr);

      // here we use libcurl to forward the SSE request because the SSE request sent by net.fetch can not be disconnected correctly in some cases
      // see https://github.com/electron/electron/issues/47097
      return await new Promise(async (resolve, reject) => {
        try {
          const { id: sessionId } = await services.userSession.get();
          const curl = new Curl();
          curl.setOpt(Curl.option.URL, urlStr);
          curl.setOpt(Curl.option.ACCEPT_ENCODING, '');
          curl.setOpt(Curl.option.SSL_OPTIONS, CurlSslOpt.NativeCa);

          if (!settings.proxyEnabled) {
            // follow system proxy
            if (!systemProxyStr) {
              // if systemProxy is empty, it means no proxy is used
              systemProxyStr = 'DIRECT';
            }

            const proxy = systemProxyStr
              .trim()
              .split(/\s*;\s*/g)
              .find(Boolean);

            // only the first proxy specified will be used
            const firstProxy = proxy;
            const parts = firstProxy?.split(/\s+/);

            const proxyType = parts?.[0];

            if (proxyType === 'DIRECT') {
              curl.setOpt(Curl.option.PROXY, '');
            } else {
              let unknownProxy = false;
              let curlOptProxyType = CurlProxy.Http;
              switch (proxyType) {
                case 'PROXY': {
                  curlOptProxyType = CurlProxy.Http;
                  break;
                }
                case 'HTTP': {
                  curlOptProxyType = CurlProxy.Http;
                  break;
                }
                case 'SOCKS': {
                  curlOptProxyType = CurlProxy.Socks4;
                  break;
                }
                case 'HTTPS': {
                  curlOptProxyType = CurlProxy.Https;
                  break;
                }
                case 'SOCKS4': {
                  curlOptProxyType = CurlProxy.Socks4;
                  break;
                }
                case 'SOCKS5': {
                  curlOptProxyType = CurlProxy.Socks5;
                  break;
                }
                default: {
                  // unknown proxy type
                  unknownProxy = true;
                  break;
                }
              }
              if (unknownProxy) {
                curl.setOpt(Curl.option.PROXY, '');
              } else if (parts?.[1]) {
                curl.setOpt(Curl.option.PROXYTYPE, curlOptProxyType);
                curl.setOpt(Curl.option.PROXY, parts[1]);
              }
            }
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
      const url = new URL(request.url);
      if (url.hostname === 'insomnia-app.local') {
        const rootDir = path.resolve(__dirname, 'client');
        const filePath = path.join(rootDir, url.pathname.startsWith('/assets') ? url.pathname : 'index.html');
        console.log(`Loading index for: ${url.pathname} from: ${filePath}`);

        return await net.fetch(`file://${filePath}`, { bypassCustomProtocolHandlers: true });
      }

      // Allow Google Fonts to bypass the custom https protocol handler.
      // Some embedded UIs (including the Customer.io in-app messaging/marketing SDK) load fonts from Google fonts.
      // When those requests are routed through our custom https handler they fail due to unknown issues.
      if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        return net.fetch(request.url, { bypassCustomProtocolHandlers: true });
      }

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
