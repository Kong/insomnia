import path from 'node:path';
import { Readable } from 'node:stream';
import { parse as urlParse } from 'node:url';

import { Curl, CurlAuth, CurlFeature, CurlSslOpt, type HeaderInfo } from '@getinsomnia/node-libcurl';
import { app, net, protocol, session } from 'electron';
import { services } from 'insomnia-data';

import { getApiBaseURL } from '../common/constants';
import { withContentSecurityPolicy } from './content-security-policy';
import { parseResolvedProxy, setDefaultProtocol, shouldBypassProxyForHost } from './network/libcurl-promise';
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
      let systemProxyStr: string | undefined;
      try {
        systemProxyStr = await session.defaultSession.resolveProxy(urlStr);
      } catch {
        // If resolveProxy fails, fall back to direct connection
      }

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
            const resolved = parseResolvedProxy(systemProxyStr);
            if (resolved) {
              curl.setOpt(Curl.option.PROXYTYPE, resolved.proxyType);
              curl.setOpt(Curl.option.PROXY, resolved.proxyUrl);
            } else {
              curl.setOpt(Curl.option.PROXY, '');
            }
          } else {
            const { protocol, hostname } = urlParse(urlStr);
            const { httpProxy, httpsProxy, noProxy } = settings;
            const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
            const proxy =
              !shouldBypassProxyForHost(hostname, noProxy) && proxyHost ? setDefaultProtocol(proxyHost) : '';
            curl.setOpt(Curl.option.PROXY, proxy);
            if (proxy) {
              curl.setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
            }
            // also pass the raw list to curl, which still correctly handles IP/CIDR entries (e.g. "192.168.0.0/16")
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
        const isAsset = url.pathname.startsWith('/assets');
        const filePath = path.join(rootDir, isAsset ? url.pathname : 'index.html');
        console.log(`Loading index for: ${url.pathname} from: ${filePath}`);

        const response = await net.fetch(`file://${filePath}`, { bypassCustomProtocolHandlers: true });

        // Apply the report-only CSP to the top-level document (index.html) only.
        // Subresources inherit the document's policy. See ./content-security-policy.
        if (!isAsset) {
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: withContentSecurityPolicy(response.headers),
          });
        }
        return response;
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
