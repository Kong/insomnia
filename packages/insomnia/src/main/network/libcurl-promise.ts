// NOTE: this file should not be imported by electron renderer because node-libcurl is not-context-aware
// Related issue https://github.com/JCMais/node-libcurl/issues/155
import fs from 'node:fs';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { parse as urlParse } from 'node:url';

import {
  Curl,
  CurlAuth,
  CurlCode,
  CurlFeature,
  CurlHttpVersion,
  CurlInfoDebug,
  CurlNetrc,
  CurlProtocol,
  CurlProxy,
  CurlSslOpt,
} from '@getinsomnia/node-libcurl';
import { isValid } from 'date-fns';
import electron from 'electron';
import type { ClientCertificate, RequestHeader, ResponseHeader, ResponseTimelineEntry } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { invariant } from '~/common/utils/invariant';

import { version } from '../../../package.json';
import { type AuthTypes, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import { cannotAccessPathError, describeByteSize, hasAuthHeader } from '../../common/misc';
import { parseHeaderStrings } from '../../network/parse-header-strings';
import { insecureReadFile, isPathAllowed } from '../secure-read-file';
import { buildMultipart } from './multipart';
import { filterHeadersForRedirect, getRedirectDecision, isSameOrigin } from './redirect-policy';
export interface CurlRequestOptions {
  requestId: string; // for cancellation
  req: RequestUsedHere;
  finalUrl: string;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCertficatePath: string | null;
  socketPath?: string;
  authHeader?: { name: string; value: string };
  // make libcurl not decompress the response content
  noDecompress?: boolean;
}
interface RequestUsedHere {
  headers: any;
  method: string;
  body: { mimeType?: string | null };
  authentication: {} | { type: AuthTypes; disabled?: boolean; username?: string; password?: string };
  settingFollowRedirects: 'global' | 'on' | 'off';
  settingRebuildPath: boolean;
  settingSendCookies: boolean;
  url: string;
  cookieJar: any;
  cookies: { name: string; value: string }[];
  suppressUserAgent: boolean;
}
interface SettingsUsedHere {
  preferredHttpVersion: string;
  maxRedirects: number;
  proxyEnabled: boolean;
  timeout: number;
  validateSSL: boolean;
  followRedirects: boolean;
  maxTimelineDataSizeKB: number;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  dataFolders: string[];
}

export interface CurlRequestOutput {
  patch: ResponsePatch;
  debugTimeline: ResponseTimelineEntry[];
  headerResults: HeaderResult[];
  responseBodyPath?: string;
}

export interface ResponsePatch {
  bodyCompression?: 'zip' | null;
  bodyPath?: string;
  bytesContent?: number;
  bytesRead?: number;
  contentType?: string;
  elapsedTime: number;
  environmentId?: string | null;
  globalEnvironmentId?: string | null;
  error?: string;
  headers?: ResponseHeader[];
  httpVersion?: string;
  message?: string;
  parentId?: string;
  settingSendCookies?: boolean;
  settingStoreCookies?: boolean;
  statusCode?: number;
  statusMessage?: string;
  timelinePath?: string;
  url?: string;
}

// NOTE: this is a dictionary of functions to close open listeners
const cancelCurlRequestHandlers: Record<string, () => void> = {};
export const cancelCurlRequest = (id: string) => cancelCurlRequestHandlers[id]?.();
export const curlRequest = (options: CurlRequestOptions) =>
  new Promise<CurlRequestOutput>(async resolve => {
    try {
      const userdataDirectory = process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');
      const responsesDir = path.join(userdataDirectory, 'responses');
      // TODO: remove this check, its only used for network.test.ts
      await fs.promises.mkdir(responsesDir, { recursive: true });
      const responseBodyPath = path.join(responsesDir, uuidv4() + '.response');

      const {
        requestId,
        req,
        finalUrl,
        settings,
        certificates,
        caCertficatePath,
        socketPath,
        authHeader,
        noDecompress = false,
      } = options;

      invariant(!finalUrl.startsWith('file://'), 'Local file URIs are not supported');
      const caCert = caCertficatePath && (await insecureReadFile(caCertficatePath));

      // Redirects are followed one hop at a time instead of letting libcurl
      // follow them internally. libcurl replays every custom HTTPHEADER to
      // each redirect target, so only manual hops can drop sensitive headers
      // before crossing origins.
      const followRedirects =
        {
          off: false,
          on: true,
          global: settings.followRedirects,
        }[req.settingFollowRedirects] ?? true;
      // Mirror libcurl's own default ceiling (30 since curl 8.3.0) when unset.
      const maxRedirects = followRedirects ? (settings.maxRedirects > 0 ? settings.maxRedirects : 30) : 0;

      // NOTE: temporary workaround for testing mockbin api
      if (process.env.PLAYWRIGHT_TEST) {
        req.headers = [...req.headers, { name: 'X-Mockbin-Test', value: 'true' }];
      }

      const { body } = req;
      const { authentication } = req;
      const requestBodyPath = await parseRequestBodyPath(body);
      const isMultipart = body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath;
      // Multipart bodies are staged in a temp file. Unlinking waits until all
      // hops finish because a preserved body may be re-sent after a redirect.
      const tempUploadPaths: string[] = isMultipart && requestBodyPath ? [requestBodyPath] : [];

      const allHeaderResults: HeaderResult[] = [];
      const debugTimeline: ResponseTimelineEntry[] = [];
      const harvestedCookieRows: string[] = [];
      let elapsedTime = 0;
      let hopCount = 0;
      let hopUrl = finalUrl;
      let hopMethod = req.method;
      let preserveHopBody = true;
      let currentFd: number | undefined;
      const closeCurrentFd = () => {
        if (currentFd !== undefined) {
          try {
            fs.closeSync(currentFd);
          } catch {
            // Already closed; abandoning a request must not throw.
          }
          currentFd = undefined;
        }
      };
      const unlinkTempUploads = () => {
        for (const tempPath of tempUploadPaths.splice(0)) {
          fs.unlink(tempPath, () => {});
        }
      };
      let activeCloser: (() => void) | null = null;
      cancelCurlRequestHandlers[requestId] = () => activeCloser?.();

      const cleanup = () => {
        delete cancelCurlRequestHandlers[requestId];
        closeCurrentFd();
        unlinkTempUploads();
      };
      const finish = (patch: ResponsePatch, headerResults: HeaderResult[]) => {
        cleanup();
        resolve({ patch, debugTimeline, headerResults, responseBodyPath });
      };
      const runHop = (hopCurl: Curl): Promise<Buffer> =>
        new Promise((hopResolve, hopReject) => {
          hopCurl.on('end', (_1: any, _2: any, rawHeaders: Buffer) => hopResolve(rawHeaders));
          hopCurl.on('error', (err: any, code: any) => hopReject({ err, code }));
          hopCurl.perform();
        });

      while (true) {
        const { curl, debugTimeline: hopTimeline } = await createConfiguredCurlInstance({
          req: { ...req, url: hopUrl },
          settings,
          caCert,
          certificates,
          socketPath,
          noDecompress,
        });
        debugTimeline.push(...hopTimeline);
        // Redirects are driven by the loop below, not by libcurl.
        curl.setOpt(Curl.option.FOLLOWLOCATION, false);
        // Re-seed cookies libcurl stored on earlier hops.
        for (const row of harvestedCookieRows) {
          curl.setOpt(Curl.option.COOKIELIST, row);
        }

        const crossOrigin = !isSameOrigin(finalUrl, hopUrl);
        const hopReq = {
          ...req,
          url: hopUrl,
          method: hopMethod,
          // Credentials are origin-bound. A cross-origin hop starts anonymous;
          // same-origin hops keep digest, NTLM, and netrc handling.
          authentication: crossOrigin ? {} : authentication,
        };
        const upperHopMethod = hopMethod.toUpperCase();
        let hopRequestBody: string | undefined;
        // Only set CURLOPT_CUSTOMREQUEST if not HEAD or GET.
        // See https://curl.haxx.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html
        // This is how you tell Curl to send a HEAD request
        if (upperHopMethod === 'HEAD') {
          curl.setOpt(Curl.option.NOBODY, 1);
        } else if (upperHopMethod === 'POST') {
          // This is how you tell Curl to send a POST request
          curl.setOpt(Curl.option.POST, 1);
        } else {
          // IMPORTANT: Only use CUSTOMREQUEST for all but HEAD and POST
          curl.setOpt(Curl.option.CUSTOMREQUEST, hopMethod);
        }
        if (preserveHopBody && requestBodyPath) {
          const { isAllowed, securedPath } = isPathAllowed(requestBodyPath, settings.dataFolders);
          invariant(isAllowed, cannotAccessPathError(securedPath));

          // AWS IAM file upload not supported
          const isAWSIAM = 'type' in authentication && authentication.type === 'iam';
          invariant(!isAWSIAM, 'AWS authentication not supported for provided body type');
          const { size: contentLength } = fs.statSync(securedPath);
          curl.setOpt(Curl.option.INFILESIZE_LARGE, contentLength);
          curl.setOpt(Curl.option.UPLOAD, 1);
          // We need this, otherwise curl will send it as a POST
          curl.setOpt(Curl.option.CUSTOMREQUEST, hopMethod);
          // The descriptor is reopened per hop because the previous hop closed it.
          currentFd = fs.openSync(securedPath, 'r');
          curl.setOpt(Curl.option.READDATA, currentFd);
        } else if (preserveHopBody) {
          hopRequestBody = parseRequestBody({ body, method: hopMethod });
        }
        // A hop that downgraded to GET keeps the GET setup above and sends no body.
        if (hopRequestBody !== undefined) {
          curl.setOpt(Curl.option.POSTFIELDS, hopRequestBody);
        }

        const headerStrings = parseHeaderStrings({
          req: hopReq,
          requestBody: hopRequestBody,
          requestBodyPath: preserveHopBody ? requestBodyPath : undefined,
          finalUrl: hopUrl,
          authHeader,
        });
        const { headers: hopHeaders, stripped } = filterHeadersForRedirect(headerStrings, {
          crossOrigin,
          preserveBody: preserveHopBody,
        });
        curl.setOpt(Curl.option.HTTPHEADER, hopHeaders);
        if (crossOrigin && stripped.length > 0) {
          debugTimeline.push({
            value: `Stripped ${stripped.join(', ')} on cross-origin redirect to ${hopUrl}`,
            name: 'Text',
            timestamp: Date.now(),
          });
        }

        // Create instance and handlers, poke value options in, set up write and debug callbacks, listen for events
        const hopStream = fs.createWriteStream(responseBodyPath);
        activeCloser = () => {
          closeCurrentFd();
          unlinkTempUploads();
          curl.isOpen && curl.close();
        };

        // set up response writer
        let hopBytes = 0;
        curl.setOpt(Curl.option.WRITEFUNCTION, buffer => {
          hopBytes += buffer.length;
          hopStream.write(buffer);
          return buffer.length;
        });

        curl.setOpt(Curl.option.DEBUGFUNCTION, (infoType, buffer) => {
          const isSSLData = infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut;
          const isEmpty = buffer.length === 0;
          // Don't show cookie setting because this will display every domain in the jar
          const isAddCookie = infoType === CurlInfoDebug.Text && buffer.toString('utf8').indexOf('Added cookie') === 0;
          if (isSSLData || isEmpty || isAddCookie) {
            return 0;
          }

          // NOTE: resolves "Text" from CurlInfoDebug[CurlInfoDebug.Text]
          let name = CurlInfoDebug[infoType] as keyof typeof CurlInfoDebug;
          let timelineMessage;
          const isRequestData = infoType === CurlInfoDebug.DataOut;
          if (isRequestData) {
            // Ignore large post data messages
            const isLessThan10KB = buffer.length / 1024 < (settings.maxTimelineDataSizeKB || 1);
            timelineMessage = isLessThan10KB ? buffer.toString('utf8') : `(${describeByteSize(buffer.length)} hidden)`;
          }
          const isResponseData = infoType === CurlInfoDebug.DataIn;
          if (isResponseData) {
            timelineMessage = `Received ${describeByteSize(buffer.length)} chunk`;
            name = 'Text';
          }
          const value = timelineMessage || buffer.toString('utf8');
          debugTimeline.push({ name, value, timestamp: Date.now() });
          return 0;
        });
        curl.enable(CurlFeature.Raw);
        let rawHeaders: Buffer;
        try {
          rawHeaders = await runHop(curl);
        } catch (failure: any) {
          const { err, code } = failure;
          hopStream.end();
          await waitForStreamToFinish(hopStream);

          // If libcurl can't decompress the response, retry without decompression
          if (code === CurlCode.CURLE_BAD_CONTENT_ENCODING && hopCount === 0 && !noDecompress) {
            cleanup();
            resolve(curlRequest({ ...options, noDecompress: true }));
            return;
          }

          let error = err + '';
          let statusMessage = 'Error';

          if (code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
            error = 'Request aborted';
            statusMessage = 'Abort';
          }
          const patch = {
            statusMessage,
            error: error || 'Something went wrong inside libcurl',
            elapsedTime,
          };

          // NOTE: legacy, default headerResults
          finish(patch, [{ version: '', code: 0, reason: '', headers: [] }]);
          return;
        }
        hopStream.end();
        await waitForStreamToFinish(hopStream);

        const hopTime = curl.getInfo(Curl.info.TOTAL_TIME) as number;
        const hopBytesRead = curl.getInfo(Curl.info.SIZE_DOWNLOAD) as number;
        elapsedTime += hopTime * 1000;
        try {
          const rows = curl.getInfo(Curl.info.COOKIELIST) as unknown as string[];
          if (Array.isArray(rows)) {
            harvestedCookieRows.push(...rows);
          }
        } catch {
          // Cookie harvest is best-effort; a hop without a cookie engine changes nothing.
        }
        curl.isOpen && curl.close();
        closeCurrentFd();

        // returns "rawHeaders" string in a buffer, rather than HeaderInfo[] type which is an object with deduped keys
        // this provides support for multiple set-cookies and duplicated headers
        const hopResults = _parseHeaders(rawHeaders);
        allHeaderResults.push(...hopResults);
        const lastBlock = hopResults[hopResults.length - 1];
        const location = lastBlock?.headers.find(header => header.name.toLowerCase() === 'location')?.value ?? null;
        const decision = getRedirectDecision({
          statusCode: lastBlock?.code ?? 0,
          location,
          method: hopMethod,
          currentUrl: hopUrl,
        });

        if (decision.action === 'follow' && hopCount < maxRedirects) {
          hopCount += 1;
          debugTimeline.push({
            value: `Following redirect ${hopCount}: ${hopMethod} ${hopUrl} → ${decision.method} ${decision.url}`,
            name: 'Text',
            timestamp: Date.now(),
          });
          hopUrl = decision.url;
          hopMethod = decision.method;
          preserveHopBody = !decision.dropBody;
          continue;
        }
        if (decision.action === 'blocked') {
          const patch = {
            statusMessage: 'Error',
            error: `Redirect to ${decision.location} is blocked: only http and https targets are supported`,
            elapsedTime,
            url: hopUrl,
          };
          finish(patch, allHeaderResults);
          return;
        }
        if (decision.action === 'follow') {
          const patch = {
            statusMessage: 'Error',
            error: `Maximum redirects (${maxRedirects}) followed`,
            elapsedTime,
            url: hopUrl,
          };
          finish(patch, allHeaderResults);
          return;
        }
        const patch = {
          bytesContent: hopBytes,
          bytesRead: hopBytesRead,
          elapsedTime,
          url: hopUrl,
        };
        finish(patch, allHeaderResults);
        return;
      }
    } catch (error) {
      console.error(error);
      const patch = {
        statusMessage: 'Error',
        error: error.toString() || 'Something went wrong performing curl',
        elapsedTime: 0,
      };
      resolve({ patch, debugTimeline: [], headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
    }
  });

/**
 * Parse a PAC-format proxy string (from Electron's session.resolveProxy) into
 * a curl proxy URL and type.  Returns null when DIRECT.
 * Format: "PROXY host:port", "HTTPS host:port", "SOCKS host:port", etc.
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file#return_value_format
 */
export function parseResolvedProxy(pacString: string | undefined): { proxyUrl: string; proxyType: CurlProxy } | null {
  if (!pacString) {
    return null;
  }
  // only the first proxy specified will be used
  const proxy = pacString
    .trim()
    .split(/\s*;\s*/g)
    .find(Boolean);
  if (!proxy) {
    return null;
  }
  const parts = proxy.split(/\s+/);
  const proxyType = parts[0];
  if (proxyType === 'DIRECT') {
    return null;
  }
  const proxyAddr = parts[1];
  if (!proxyAddr) {
    return null;
  }
  let curlProxyType: CurlProxy;
  switch (proxyType) {
    case 'PROXY':
    case 'HTTP': {
      curlProxyType = CurlProxy.Http;
      break;
    }
    case 'HTTPS': {
      curlProxyType = CurlProxy.Https;
      break;
    }
    case 'SOCKS':
    case 'SOCKS4': {
      curlProxyType = CurlProxy.Socks4;
      break;
    }
    case 'SOCKS5': {
      curlProxyType = CurlProxy.Socks5;
      break;
    }
    default: {
      return null;
    }
  }
  return { proxyUrl: proxyAddr, proxyType: curlProxyType };
}

export const createConfiguredCurlInstance = async ({
  req,
  settings,
  caCert,
  certificates,
  socketPath,
  noDecompress = false,
}: {
  req: RequestUsedHere;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCert: string | null;
  socketPath?: string;
  noDecompress?: boolean;
}) => {
  const debugTimeline: ResponseTimelineEntry[] = [];
  const curl = new Curl();
  const finalUrl = req.url;
  curl.setOpt(Curl.option.URL, finalUrl);
  socketPath && curl.setOpt(Curl.option.UNIX_SOCKET_PATH, socketPath);

  // Set all the basic options

  // True so debug function works
  curl.setOpt(Curl.option.VERBOSE, true);
  // True so curl doesn't print progress
  curl.setOpt(Curl.option.NOPROGRESS, true);
  // whether to decompress response content
  curl.setOpt(Curl.option.ACCEPT_ENCODING, noDecompress ? null : '');
  // fallback to root certificates or leave unset to use keychain on macOS
  if (caCert) {
    curl.setOpt(Curl.option.CAINFO_BLOB, caCert);
  }
  // Use the system's native CA store for SSL certificate verification
  curl.setOpt(Curl.option.SSL_OPTIONS, CurlSslOpt.NativeCa);
  certificates.forEach(validCert => {
    const { passphrase, cert, key, pfx } = validCert;
    if (cert) {
      const { isAllowed, securedPath } = isPathAllowed(cert, settings.dataFolders);
      invariant(isAllowed, cannotAccessPathError(securedPath));

      curl.setOpt(Curl.option.SSLCERT, cert);
      curl.setOpt(Curl.option.SSLCERTTYPE, 'PEM');
      debugTimeline.push({ value: 'Adding SSL PEM certificate', name: 'Text', timestamp: Date.now() });
    }
    if (pfx) {
      const { isAllowed, securedPath } = isPathAllowed(pfx, settings.dataFolders);
      invariant(isAllowed, cannotAccessPathError(securedPath));

      curl.setOpt(Curl.option.SSLCERT, pfx);
      curl.setOpt(Curl.option.SSLCERTTYPE, 'P12');
      debugTimeline.push({ value: 'Adding SSL P12 certificate', name: 'Text', timestamp: Date.now() });
    }
    if (key) {
      const { isAllowed, securedPath } = isPathAllowed(key, settings.dataFolders);
      invariant(isAllowed, cannotAccessPathError(securedPath));

      curl.setOpt(Curl.option.SSLKEY, key);
      debugTimeline.push({ value: 'Adding SSL KEY certificate', name: 'Text', timestamp: Date.now() });
    }
    if (passphrase) {
      curl.setOpt(Curl.option.KEYPASSWD, passphrase);
    }
  });
  const httpVersion = getHttpVersion(settings.preferredHttpVersion);
  debugTimeline.push({ value: httpVersion.log, name: 'Text', timestamp: Date.now() });

  if (httpVersion.curlHttpVersion) {
    curl.setOpt(Curl.option.HTTP_VERSION, httpVersion.curlHttpVersion);
  }

  // Set maximum amount of redirects allowed
  // NOTE: Setting this to -1 breaks some versions of libcurl
  if (settings.maxRedirects > 0) {
    curl.setOpt(Curl.option.MAXREDIRS, settings.maxRedirects);
  }

  if (!settings.proxyEnabled) {
    // When proxy is not explicitly configured, fall back to system proxy
    let resolved: ReturnType<typeof parseResolvedProxy> = null;
    try {
      const systemProxy = await electron.session.defaultSession.resolveProxy(finalUrl);
      resolved = parseResolvedProxy(systemProxy);
    } catch {
      // If resolveProxy fails (e.g. invalid URL, session issues), fall back to direct connection
    }
    if (resolved) {
      curl.setOpt(Curl.option.PROXYTYPE, resolved.proxyType);
      curl.setOpt(Curl.option.PROXY, resolved.proxyUrl);
      debugTimeline.push({ value: `Using system proxy: ${resolved.proxyUrl}`, name: 'Text', timestamp: Date.now() });
    } else {
      curl.setOpt(Curl.option.PROXY, '');
    }
  } else {
    const { protocol, hostname } = urlParse(finalUrl);
    const { httpProxy, httpsProxy, noProxy } = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = !shouldBypassProxyForHost(hostname, noProxy) && proxyHost ? setDefaultProtocol(proxyHost) : '';
    curl.setOpt(Curl.option.PROXY, proxy);
    if (proxy) {
      debugTimeline.push({ value: `Using proxy: ${proxy}`, name: 'Text', timestamp: Date.now() });
      curl.setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
    }
    // also pass the raw list to curl, which still correctly handles IP/CIDR entries (e.g. "192.168.0.0/16")
    if (noProxy) {
      curl.setOpt(Curl.option.NOPROXY, noProxy);
    }
  }
  const { timeout } = settings;
  if (timeout <= 0) {
    curl.setOpt(Curl.option.TIMEOUT_MS, 0);
  } else {
    curl.setOpt(Curl.option.TIMEOUT_MS, timeout);
    debugTimeline.push({ value: `Enable timeout of ${timeout}ms`, name: 'Text', timestamp: Date.now() });
  }
  const { validateSSL } = settings;
  if (!validateSSL) {
    // Disable certificate verification
    curl.setOpt(Curl.option.SSL_VERIFYHOST, 0);
    // Disable hostname verification
    curl.setOpt(Curl.option.SSL_VERIFYPEER, 0);
  }
  debugTimeline.push({
    value: `${validateSSL ? 'Enable' : 'Disable'} SSL validation`,
    name: 'Text',
    timestamp: Date.now(),
  });

  const followRedirects =
    {
      off: false,
      on: true,
      global: settings.followRedirects,
    }[req.settingFollowRedirects] ?? true;

  curl.setOpt(Curl.option.FOLLOWLOCATION, followRedirects);

  // Redirects stay within HTTP(S). The entry file:// guard only covers the
  // initial URL, so without this a malicious redirect target could point at
  // file://, gopher://, dict://, or ftp:// instead.
  curl.setOpt(Curl.option.REDIR_PROTOCOLS, CurlProtocol.HTTP | CurlProtocol.HTTPS);

  // Don't rebuild dot sequences in path
  if (!req.settingRebuildPath) {
    curl.setOpt(Curl.option.PATH_AS_IS, true);
  }

  if (req.settingSendCookies) {
    const { cookieJar, cookies } = req;
    curl.setOpt(Curl.option.COOKIEFILE, '');

    for (const { name, value } of cookies) {
      curl.setOpt(Curl.option.COOKIE, `${name}=${value}`);
    }
    // set-cookies from previous redirects
    if (cookieJar.cookies.length) {
      debugTimeline.push({
        value: `Enable cookie sending with jar of ${cookieJar.cookies.length} cookie${cookieJar.cookies.length !== 1 ? 's' : ''}`,
        name: 'Text',
        timestamp: Date.now(),
      });
      for (const cookie of cookieJar.cookies) {
        const setCookie = [
          cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
          cookie.hostOnly ? 'FALSE' : 'TRUE',
          cookie.path,
          cookie.secure ? 'TRUE' : 'FALSE',
          cookie.expires && isValid(new Date(cookie.expires))
            ? Math.round(new Date(cookie.expires).getTime() / 1000)
            : 0,
          cookie.key,
          cookie.value,
        ].join('\t');
        curl.setOpt(Curl.option.COOKIELIST, setCookie);
      }
    }
  }
  const { headers, authentication } = req;

  const userAgent: RequestHeader | null = headers.find((h: any) => h.name.toLowerCase() === 'user-agent') || null;
  const userAgentOrFallback = typeof userAgent?.value === 'string' ? userAgent?.value : 'insomnia/' + version;
  curl.setOpt(Curl.option.USERAGENT, userAgentOrFallback);
  if (req.suppressUserAgent) {
    curl.setOpt(Curl.option.USERAGENT, '');
  }
  if (authentication && 'type' in authentication) {
    const { username, password, disabled } = authentication;
    const isDigest = authentication.type === 'digest';
    const isNLTM = authentication.type === 'ntlm';
    const isDigestOrNLTM = isDigest || isNLTM;
    if (!hasAuthHeader(headers) && !disabled && isDigestOrNLTM) {
      isDigest && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Digest);
      isNLTM && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Ntlm);
      curl.setOpt(Curl.option.USERNAME, username || '');
      curl.setOpt(Curl.option.PASSWORD, password || '');
    }
    if (authentication.type === 'netrc') {
      curl.setOpt(Curl.option.NETRC, CurlNetrc.Required);
    }
  }
  return { curl, debugTimeline };
};

export interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}
export function _parseHeaders(buffer: Buffer): HeaderResult[] {
  // split on two new lines
  const redirects = buffer.toString('utf8').split(/\r?\n\r?\n|\r\r/g);
  return redirects
    .filter(r => !!r.trim())
    .map(redirect => {
      // split on one new line
      const [first, ...rest] = redirect.split(/\r?\n|\r/g);
      const headers = rest
        .map(l => l.split(/:\s(.+)/))
        .filter(([n]) => !!n)
        .map(([name, value = '']) => ({ name, value }));

      const [version, code, ...other] = first.split(/ +/g);
      return {
        version,
        code: Number.parseInt(code, 10),
        reason: other.join(' '),
        headers,
      };
    });
}

// NOTE: legacy, suspicious, could be simplified
async function waitForStreamToFinish(stream: Readable | Writable) {
  return new Promise<void>(resolve => {
    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._readableState?.finished) {
      return resolve();
    }

    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._writableState?.finished) {
      return resolve();
    }

    stream.on('close', () => {
      resolve();
    });
    stream.on('error', () => {
      resolve();
    });
  });
}
const parseRequestBody = ({ body, method }: { body: any; method: string }) => {
  const isUrlEncodedForm = body.mimeType === CONTENT_TYPE_FORM_URLENCODED;
  const expectsBody = ['POST', 'PUT', 'PATCH', 'QUERY'].includes(method.toUpperCase());
  const hasMimetypeAndUpdateMethod = typeof body.mimeType === 'string' || expectsBody;
  if (isUrlEncodedForm) {
    const urlSearchParams = new URLSearchParams();
    (body.params || []).map((p: { name: string; value: any }) => urlSearchParams.append(p.name, p?.value || ''));
    return urlSearchParams.toString();
  }

  if (hasMimetypeAndUpdateMethod) {
    return body.text || '';
  }

  return;
};
const parseRequestBodyPath = async (body: any) => {
  const isMultipartForm = body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (!isMultipartForm) {
    return body.fileName;
  }
  const { filePath } = await buildMultipart(body.params || []);
  return filePath;
};

export const getHttpVersion = (preferredHttpVersion: string) => {
  switch (preferredHttpVersion) {
    case 'V1_0': {
      return { log: 'Using HTTP 1.0', curlHttpVersion: CurlHttpVersion.V1_0 };
    }
    case 'V1_1': {
      return { log: 'Using HTTP 1.1', curlHttpVersion: CurlHttpVersion.V1_1 };
    }
    case 'V2PriorKnowledge': {
      return { log: 'Using HTTP/2 PriorKnowledge', curlHttpVersion: CurlHttpVersion.V2PriorKnowledge };
    }
    case 'V2_0': {
      return { log: 'Using HTTP/2', curlHttpVersion: CurlHttpVersion.V2_0 };
    }
    case 'v3': {
      return { log: 'Using HTTP/3', curlHttpVersion: CurlHttpVersion.v3 };
    }
    case 'default': {
      return { log: 'Using default HTTP version' };
    }
    default: {
      return { log: `Unknown HTTP version specified ${preferredHttpVersion}` };
    }
  }
};

// workaround for a curl 7.86 bug: https://github.com/curl/curl/issues/10122
export function shouldBypassProxyForHost(hostname: string | null, noProxy: string): boolean {
  if (!hostname || !noProxy) {
    return false;
  }

  const normalizedHostname = hostname.toLowerCase();

  return noProxy
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
    .some(entry => {
      if (entry.startsWith('.')) {
        return normalizedHostname === entry.slice(1) || normalizedHostname.endsWith(entry);
      }
      return normalizedHostname === entry;
    });
}

export const setDefaultProtocol = (url: string, defaultProto?: string) => {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!trimmedUrl) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (!trimmedUrl.includes('://')) {
    return `${defaultProto}//${trimmedUrl}`;
  }

  return trimmedUrl;
};
