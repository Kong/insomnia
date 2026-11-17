import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { parse as urlParse,pathToFileURL } from 'node:url';

import { Curl, CurlAuth, CurlFeature, CurlSslOpt, type HeaderInfo } from '@getinsomnia/node-libcurl';
import { app, net, protocol, session } from 'electron';
import { services } from 'insomnia-data';
import { ProxyScopes, setDefaultProtocol } from 'insomnia-data/common';

import { getApiBaseURL } from '../common/constants';
import { parseResolvedProxy, shouldBypassProxyForHost } from './network/libcurl-promise';
import { resolveDbByKey } from './templating-worker-database';

/**
 * Resolve the on-disk file served for a request path of the app's custom origin.
 * The pathname is decoded here (the later file:// fetch would otherwise decode %2f / %5c
 * after path.join has already run) and the result must stay inside rootDir.
 * Returns null when the path is malformed or escapes rootDir.
 */
export function resolveClientFilePath(rootDir: string, pathname: string): string | null {
  if (!pathname.startsWith('/assets')) {
    return path.join(rootDir, 'index.html');
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const resolved = path.resolve(rootDir, `.${decoded}`);
  const relative = path.relative(rootDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

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
        corsEnabled: true,
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
      privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
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
          } else if (settings.proxyScope !== ProxyScopes.all) {
            curl.setOpt(Curl.option.PROXY, '');
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
        const filePath = resolveClientFilePath(rootDir, url.pathname);
        if (!filePath) {
          return new Response('Not found', { status: 404 });
        }
        // Symlinks must not let an in-tree path point outside rootDir
        try {
          const realRoot = fs.realpathSync(rootDir);
          const realFile = fs.realpathSync(filePath);
          const rel = path.relative(realRoot, realFile);
          if (rel.startsWith('..') || path.isAbsolute(rel)) {
            return new Response('Not found', { status: 404 });
          }
        } catch {
          // file does not exist: let the fetch below produce its normal error
        }
        console.log(`Loading index for: ${url.pathname} from: ${filePath}`);

        return await net.fetch(pathToFileURL(filePath).href, { bypassCustomProtocolHandlers: true });
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
