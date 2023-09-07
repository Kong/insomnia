// NOTE: this file should not be imported by electron renderer because node-libcurl is not-context-aware
// Related issue https://github.com/JCMais/node-libcurl/issues/155
import { invariant } from '../../utils/invariant';
invariant(process.type !== 'renderer', 'Native abstractions for Nodejs module unavailable in renderer');

import { Curl, CurlAuth, CurlCode, CurlFeature, CurlHttpVersion, CurlInfoDebug, CurlNetrc } from '@getinsomnia/node-libcurl';
import electron from 'electron';
import fs from 'fs';
import path from 'path';
import { Readable, Writable } from 'stream';
import tls from 'tls';
import { parse as urlParse } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { version } from '../../../package.json';
import { AUTH_AWS_IAM, AUTH_DIGEST, AUTH_NETRC, AUTH_NTLM, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import { describeByteSize, hasAuthHeader } from '../../common/misc';
import { ClientCertificate } from '../../models/client-certificate';
import { RequestHeader } from '../../models/request';
import { ResponseHeader } from '../../models/response';
import { buildMultipart } from './multipart';
import { parseHeaderStrings } from './parse-header-strings';
export interface CurlRequestOptions {
  requestId: string; // for cancellation
  req: RequestUsedHere;
  finalUrl: string;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCertficatePath: string | null;
  socketPath?: string;
  authHeader?: { name: string; value: string };
}
interface RequestUsedHere {
  headers: any;
  method: string;
  body: { mimeType?: string | null };
  authentication: Record<string, any>;
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
}

export interface ResponseTimelineEntry {
  name: keyof typeof CurlInfoDebug;
  timestamp: number;
  value: string;
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
const getDataDirectory = () => process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');

// NOTE: this is a dictionary of functions to close open listeners
const cancelCurlRequestHandlers: Record<string, () => void> = {};
export const cancelCurlRequest = (id: string) => cancelCurlRequestHandlers[id]();
export const curlRequest = (options: CurlRequestOptions) => new Promise<CurlRequestOutput>(async resolve => {
  try {
    const responsesDir = path.join(getDataDirectory(), 'responses');
    fs.mkdirSync(responsesDir, { recursive: true });

    const responseBodyPath = path.join(responsesDir, uuidv4() + '.response');

    const { requestId, req, finalUrl, settings, certificates, caCertficatePath, socketPath, authHeader } = options;
    const caCert = (caCertficatePath && (await fs.promises.readFile(caCertficatePath)).toString()) || tls.rootCertificates.join('\n');

    const { curl, debugTimeline } = createConfiguredCurlInstance({
      req,
      finalUrl,
      settings,
      caCert,
      certificates,
      socketPath,
    });
    const { method, body } = req;
    // Only set CURLOPT_CUSTOMREQUEST if not HEAD or GET.
    // See https://curl.haxx.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html
    // This is how you tell Curl to send a HEAD request
    if (method.toUpperCase() === 'HEAD') {
      curl.setOpt(Curl.option.NOBODY, 1);
    } else if (method.toUpperCase() === 'POST') { // This is how you tell Curl to send a POST request
      curl.setOpt(Curl.option.POST, 1);
    } else { // IMPORTANT: Only use CUSTOMREQUEST for all but HEAD and POST
      curl.setOpt(Curl.option.CUSTOMREQUEST, method);
    }

    const requestBodyPath = await parseRequestBodyPath(body);
    const requestBody = parseRequestBody({ body, method });
    const isMultipart = body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath;
    let requestFileDescriptor: number | undefined;
    const { authentication } = req;
    if (requestBodyPath) {
      // AWS IAM file upload not supported
      invariant(authentication.type !== AUTH_AWS_IAM, 'AWS authentication not supported for provided body type');
      const { size: contentLength } = fs.statSync(requestBodyPath);
      curl.setOpt(Curl.option.INFILESIZE_LARGE, contentLength);
      curl.setOpt(Curl.option.UPLOAD, 1);
      // We need this, otherwise curl will send it as a POST
      curl.setOpt(Curl.option.CUSTOMREQUEST, method);
      // read file into request and close file descriptor
      requestFileDescriptor = fs.openSync(requestBodyPath, 'r');
      curl.setOpt(Curl.option.READDATA, requestFileDescriptor);
      curl.on('end', () => closeReadFunction(isMultipart, requestFileDescriptor, requestBodyPath));
      curl.on('error', () => closeReadFunction(isMultipart, requestFileDescriptor, requestBodyPath));
    } else if (requestBody !== undefined) {
      curl.setOpt(Curl.option.POSTFIELDS, requestBody);
    }

    const headerStrings = parseHeaderStrings({ req, requestBody, requestBodyPath, finalUrl, authHeader });
    curl.setOpt(Curl.option.HTTPHEADER, headerStrings);

    // Create instance and handlers, poke value options in, set up write and debug callbacks, listen for events
    const responseBodyWriteStream = fs.createWriteStream(responseBodyPath);
    // cancel request by id map
    cancelCurlRequestHandlers[requestId] = () => {
      if (requestFileDescriptor && responseBodyPath) {
        closeReadFunction(isMultipart, requestFileDescriptor, requestBodyPath);
      }
      curl.close();
    };

    // set up response writer
    let responseBodyBytes = 0;
    curl.setOpt(Curl.option.WRITEFUNCTION, buffer => {
      responseBodyBytes += buffer.length;
      responseBodyWriteStream.write(buffer);
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
    // returns "rawHeaders" string in a buffer, rather than HeaderInfo[] type which is an object with deduped keys
    // this provides support for multiple set-cookies and duplicated headers
    curl.enable(CurlFeature.Raw);
    // NOTE: legacy write end callback
    curl.on('end', () => responseBodyWriteStream.end());
    curl.on('end', async (_1: any, _2: any, rawHeaders: Buffer) => {
      const patch = {
        bytesContent: responseBodyBytes,
        bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD) as number,
        elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000,
        url: curl.getInfo(Curl.info.EFFECTIVE_URL) as string,
      };
      curl.close();
      await waitForStreamToFinish(responseBodyWriteStream);

      const headerResults = _parseHeaders(rawHeaders);
      resolve({ patch, debugTimeline, headerResults, responseBodyPath });
    });
    // NOTE: legacy write end callback
    curl.on('error', () => responseBodyWriteStream.end());
    curl.on('error', async (err, code) => {
      const elapsedTime = curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000;
      curl.close();
      await waitForStreamToFinish(responseBodyWriteStream);

      let error = err + '';
      let statusMessage = 'Error';

      if (code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
        error = 'Request aborted';
        statusMessage = 'Abort';
      }
      const patch = {
        statusMessage,
        error: error || 'Something went wrong',
        elapsedTime,
      };

      // NOTE: legacy, default headerResults
      resolve({ patch, debugTimeline, headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
    });
    curl.perform();
  } catch (error) {
    console.error(error);
    const patch = {
      statusMessage: 'Error',
      error: error.message || 'Something went wrong',
      elapsedTime: 0,
    };
    resolve({ patch, debugTimeline: [], headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
  }
});

export const createConfiguredCurlInstance = ({
  req,
  finalUrl,
  settings,
  caCert,
  certificates,
  socketPath,
}: {
  req: RequestUsedHere;
  finalUrl: string;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCert: string;
  socketPath?: string;
}) => {
  const debugTimeline: ResponseTimelineEntry[] = [];
  const curl = new Curl();
  curl.setOpt(Curl.option.URL, finalUrl);
  socketPath && curl.setOpt(Curl.option.UNIX_SOCKET_PATH, socketPath);

  curl.setOpt(Curl.option.VERBOSE, true); // Set all the basic options
  curl.setOpt(Curl.option.NOPROGRESS, true); // True so debug function works
  curl.setOpt(Curl.option.ACCEPT_ENCODING, ''); // True so curl doesn't print progress
  // attempt to read CA Certificate PEM from disk, fallback to root certificates
  curl.setOpt(Curl.option.CAINFO_BLOB, caCert);
  certificates.forEach(validCert => {
    const { passphrase, cert, key, pfx } = validCert;
    if (cert) {
      curl.setOpt(Curl.option.SSLCERT, cert);
      curl.setOpt(Curl.option.SSLCERTTYPE, 'PEM');
      debugTimeline.push({ value: 'Adding SSL PEM certificate', name: 'Text', timestamp: Date.now() });
    }
    if (pfx) {
      curl.setOpt(Curl.option.SSLCERT, pfx);
      curl.setOpt(Curl.option.SSLCERTTYPE, 'P12');
      debugTimeline.push({ value: 'Adding SSL P12 certificate', name: 'Text', timestamp: Date.now() });
    }
    if (key) {
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
    curl.setOpt(Curl.option.PROXY, '');
  } else {
    const { protocol } = urlParse(req.url);
    const { httpProxy, httpsProxy, noProxy } = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
    debugTimeline.push({ value: `Enable network proxy for ${protocol || ''}`, name: 'Text', timestamp: Date.now() });
    if (proxy) {
      curl.setOpt(Curl.option.PROXY, proxy);
      curl.setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
    }
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
    curl.setOpt(Curl.option.SSL_VERIFYHOST, 0);
    curl.setOpt(Curl.option.SSL_VERIFYPEER, 0);
  }
  debugTimeline.push({ value: `${validateSSL ? 'Enable' : 'Disable'} SSL validation`, name: 'Text', timestamp: Date.now() });

  const followRedirects = {
    'off': false,
    'on': true,
    'global': settings.followRedirects,
  }[req.settingFollowRedirects] ?? true;

  curl.setOpt(Curl.option.FOLLOWLOCATION, followRedirects);

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
      debugTimeline.push({ value: `Enable cookie sending with jar of ${cookieJar.cookies.length} cookie${cookieJar.cookies.length !== 1 ? 's' : ''}`, name: 'Text', timestamp: Date.now() });
      for (const cookie of cookieJar.cookies) {
        const setCookie = [
          cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
          cookie.hostOnly ? 'FALSE' : 'TRUE',
          cookie.path,
          cookie.secure ? 'TRUE' : 'FALSE',
          cookie.expires ? Math.round(new Date(cookie.expires).getTime() / 1000) : 0,
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

  const { username, password, disabled } = authentication;
  const isDigest = authentication.type === AUTH_DIGEST;
  const isNLTM = authentication.type === AUTH_NTLM;
  const isDigestOrNLTM = isDigest || isNLTM;
  if (!hasAuthHeader(headers) && !disabled && isDigestOrNLTM) {
    isDigest && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Digest);
    isNLTM && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Ntlm);
    curl.setOpt(Curl.option.USERNAME, username || '');
    curl.setOpt(Curl.option.PASSWORD, password || '');
  }
  if (authentication.type === AUTH_NETRC) {
    curl.setOpt(Curl.option.NETRC, CurlNetrc.Required);
  }

  return { curl, debugTimeline };
};

const closeReadFunction = (isMultipart: boolean, fd?: number, path?: string) => {
  if (fd) {
    fs.closeSync(fd);
  }
  // NOTE: multipart files are combined before sending, so this file is deleted after
  // alt implementation to send one part at a time https://github.com/JCMais/node-libcurl/blob/develop/examples/04-multi.js
  if (isMultipart && path) {
    fs.unlink(path, () => { });
  }
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
  return redirects.filter(r => !!r.trim()).map(redirect => {
    // split on one new line
    const [first, ...rest] = redirect.split(/\r?\n|\r/g);
    const headers = rest.map(l => l.split(/:\s(.+)/))
      .filter(([n]) => !!n)
      .map(([name, value = '']) => ({ name, value }));

    const [version, code, ...other] = first.split(/ +/g);
    return {
      version,
      code: parseInt(code, 10),
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
  const expectsBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
  const hasMimetypeAndUpdateMethod = typeof body.mimeType === 'string' || expectsBody;
  if (isUrlEncodedForm) {
    const urlSearchParams = new URLSearchParams();
    (body.params || []).map((p: { name: string; value: any }) => urlSearchParams.append(p.name, p?.value || ''));
    return urlSearchParams.toString();
  }

  if (hasMimetypeAndUpdateMethod) {
    return body.text || '';
  }

  return undefined;
};
const parseRequestBodyPath = async (body: any) => {
  const isMultipartForm = body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (!isMultipartForm) {
    return body.fileName;
  }
  const { filePath } = await buildMultipart(body.params || [],);
  return filePath;
};

export const getHttpVersion = (preferredHttpVersion: string) => {
  switch (preferredHttpVersion) {
    case 'V1_0':
      return { log: 'Using HTTP 1.0', curlHttpVersion: CurlHttpVersion.V1_0 };
    case 'V1_1':
      return { log: 'Using HTTP 1.1', curlHttpVersion: CurlHttpVersion.V1_1 };
    case 'V2PriorKnowledge':
      return { log: 'Using HTTP/2 PriorKnowledge', curlHttpVersion: CurlHttpVersion.V2PriorKnowledge };
    case 'V2_0':
      return { log: 'Using HTTP/2', curlHttpVersion: CurlHttpVersion.V2_0 };
    case 'v3':
      return { log: 'Using HTTP/3', curlHttpVersion: CurlHttpVersion.v3 };
    case 'default':
      return { log: 'Using default HTTP version' };
    default:
      return { log: `Unknown HTTP version specified ${preferredHttpVersion}` };
  }
};
const setDefaultProtocol = (url: string, defaultProto?: string) => {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!trimmedUrl) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (trimmedUrl.indexOf('://') === -1) {
    return `${defaultProto}//${trimmedUrl}`;
  }

  return trimmedUrl;
};
