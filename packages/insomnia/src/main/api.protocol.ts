import path from 'node:path';
import { isReadable, Readable, Writable } from 'node:stream';
import { parse as urlParse } from 'node:url';

import { Curl, CurlAuth, CurlFeature, CurlProxy, CurlSslOpt, type HeaderInfo } from '@getinsomnia/node-libcurl';
import {
  app,
  type ClientRequest,
  type ClientRequestConstructorOptions,
  type IncomingMessage,
  net,
  protocol,
  type Session,
  session,
} from 'electron';

import { services } from '~/insomnia-data';

import { getApiBaseURL } from '../common/constants';
import { setDefaultProtocol } from './network/libcurl-promise';
import { resolveDbByKey } from './templating-worker-database';

function createDeferredPromise<T, E extends Error = Error>(): {
  promise: Promise<T>;
  resolve: (x: T) => void;
  reject: (e: E) => void;
} {
  let res: (x: T) => void;
  let rej: (e: E) => void;
  const promise = new Promise<T>((resolve, reject) => {
    res = resolve;
    rej = reject;
  });

  return { promise, resolve: res!, reject: rej! };
}

function fetchWithSession(
  input: RequestInfo,
  init: (RequestInit & { bypassCustomProtocolHandlers?: boolean }) | undefined,
  session: Session | undefined,
  request: (options: ClientRequestConstructorOptions | string) => ClientRequest,
) {
  const p = createDeferredPromise<Response>();
  let req: Request;
  try {
    req = new Request(input, init);
  } catch (e: any) {
    p.reject(e);
    return p.promise;
  }

  if (req.signal.aborted) {
    // 1. Abort the fetch() call with p, request, null, and
    //    requestObject’s signal’s abort reason.
    const error = (req.signal as any).reason ?? new DOMException('The operation was aborted.', 'AbortError');
    p.reject(error);

    if (req.body != null && isReadable(req.body as unknown as NodeJS.ReadableStream)) {
      req.body.cancel(error).catch(err => {
        if (err.code === 'ERR_INVALID_STATE') {
          // Node bug?
          return;
        }
        throw err;
      });
    }

    // 2. Return p.
    return p.promise;
  }

  let locallyAborted = false;
  req.signal.addEventListener(
    'abort',
    () => {
      // 1. Set locallyAborted to true.
      locallyAborted = true;

      // 2. Abort the fetch() call with p, request, responseObject,
      //    and requestObject’s signal’s abort reason.
      const error = (req.signal as any).reason ?? new DOMException('The operation was aborted.', 'AbortError');
      p.reject(error);
      if (req.body != null && isReadable(req.body as unknown as NodeJS.ReadableStream)) {
        req.body.cancel(error).catch(err => {
          if (err.code === 'ERR_INVALID_STATE') {
            // Node bug?
            return;
          }
          throw err;
        });
      }

      r.abort();
    },
    { once: true },
  );

  const origin = req.headers.get('origin') ?? undefined;
  // We can't set credentials to same-origin unless there's an origin set.
  const credentials = req.credentials === 'same-origin' && !origin ? 'include' : req.credentials;

  const r = request({
    session,
    method: req.method,
    url: req.url,
    origin,
    credentials,
    cache: req.cache,
    referrerPolicy: req.referrerPolicy,
    redirect: req.redirect,
  });

  (r as any)._urlLoaderOptions.bypassCustomProtocolHandlers = !!init?.bypassCustomProtocolHandlers;

  // cors is the default mode, but we can't set mode=cors without an origin.
  if (req.mode && (req.mode !== 'cors' || origin)) {
    r.setHeader('Sec-Fetch-Mode', req.mode);
  }

  for (const [k, v] of req.headers) {
    r.setHeader(k, v);
  }

  r.on('response', (resp: IncomingMessage) => {
    if (locallyAborted) return;
    const headers = new Headers();
    for (const [k, v] of Object.entries(resp.headers)) {
      headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    }
    const nullBodyStatus = [101, 204, 205, 304];
    const body =
      nullBodyStatus.includes(resp.statusCode) || req.method === 'HEAD'
        ? null
        : (Readable.toWeb(resp as unknown as Readable) as ReadableStream);
    const rResp = new Response(body, {
      headers,
      status: resp.statusCode,
      statusText: resp.statusMessage,
    });
    (rResp as any).__original_resp = resp;
    p.resolve(rResp);
  });

  r.on('error', err => {
    p.reject(err);
  });

  r.on('login', (authInfo, callback) => {
    console.log(
      '-------------------------------------',
      'client request login',
      '-------------------------------------',
    );
    console.log(JSON.stringify(authInfo, null, 2));
    callback('user', 'password');
    // callback();
  });

  // pipeTo expects a WritableStream<Uint8Array>. Node.js' Writable.toWeb returns WritableStream<any>,
  // which causes a TS structural mismatch.
  const writable = Writable.toWeb(r as unknown as Writable) as unknown as WritableStream<Uint8Array>;
  if (!req.body?.pipeTo(writable).then(() => r.end())) {
    r.end();
  }

  return p.promise;
}

const netFetchWithProxyAuthentication: typeof net.fetch = (input, init) => {
  console.log(
    '-------------------------------------',
    `fetching ${typeof input === 'string' ? input : input.url}`,
    '-------------------------------------',
  );
  return fetchWithSession(input, init, session.defaultSession, net.request);
};

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
        return netFetchWithProxyAuthentication(request.url, { bypassCustomProtocolHandlers: true });
      }

      return netFetchWithProxyAuthentication(request, { bypassCustomProtocolHandlers: true });
    });
  }
  if (!protocol.isProtocolHandled(httpScheme)) {
    protocol.handle(httpScheme, async request => {
      return netFetchWithProxyAuthentication(request, { bypassCustomProtocolHandlers: true });
    });
  }
  if (!protocol.isProtocolHandled(templatingWorkerDatabaseInterface)) {
    protocol.handle(templatingWorkerDatabaseInterface, resolveDbByKey);
  }
}
