// NOTE: this file should not be imported by electron renderer because node-libcurl is not-context-aware
// Related issue https://github.com/JCMais/node-libcurl/issues/155
if (process.type === 'renderer') {
  throw new Error('node-libcurl unavailable in renderer');
}

import { Curl, CurlAuth, CurlCode, CurlFeature, CurlHttpVersion, CurlInfoDebug, CurlNetrc } from '@getinsomnia/node-libcurl';
import electron from 'electron';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import { Readable, Writable } from 'stream';
import { ValueOf } from 'type-fest';
import { parse as urlParse } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { version } from '../../config/config.json';
import { AUTH_AWS_IAM, AUTH_DIGEST, AUTH_NETRC, AUTH_NTLM, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED } from '../common/constants';
import { describeByteSize, hasAuthHeader, hasUserAgentHeader } from '../common/misc';
import { ResponseHeader } from '../models/response';
import type { Settings } from '../models/settings';
import { buildMultipart } from './multipart';
import { ResponsePatch } from './network';
import { parseHeaderStrings } from './parse-header-strings';

// wraps libcurl with a promise taking curl options and others required by read, write and debug callbacks
// returning a response patch, debug timeline and list of headers for each redirect

interface CurlOpt {
  key: Parameters<Curl['setOpt']>[0];
  value: Parameters<Curl['setOpt']>[1];
}

interface CurlRequestOptions {
  curlOptions: CurlOpt[];
  requestId: string; // for cancellation
  renderedRequest: any;
  finalUrl: string;
  settings: Settings;
}

interface ResponseTimelineEntry {
  name: ValueOf<typeof LIBCURL_DEBUG_MIGRATION_MAP>;
  timestamp: number;
  value: string;
}

interface CurlRequestOutput {
  patch: ResponsePatch;
  debugTimeline: ResponseTimelineEntry[];
  headerResults: HeaderResult[];
  responseBodyPath?: string;
}

const getDataDirectory = () => process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');

// NOTE: this is a dictionary of functions to close open listeners
const cancelCurlRequestHandlers = {};
export const cancelCurlRequest = id => cancelCurlRequestHandlers[id]();
export const curlRequest = (options: CurlRequestOptions) => new Promise<CurlRequestOutput>(async resolve => {
  try {
    const responsesDir = path.join(getDataDirectory(), 'responses');
    mkdirp.sync(responsesDir);
    const responseBodyPath = path.join(responsesDir, uuidv4() + '.response');
    const debugTimeline: ResponseTimelineEntry[] = [];
    // Create instance and handlers, poke value options in, set up write and debug callbacks, listen for events
    const { curlOptions, requestId, renderedRequest, finalUrl, settings } = options;
    const curl = new Curl();

    curl.setOpt(Curl.option.VERBOSE, true); // Set all the basic options
    curl.setOpt(Curl.option.NOPROGRESS, true); // True so debug function works
    curl.setOpt(Curl.option.ACCEPT_ENCODING, ''); // True so curl doesn't print progress

    const httpVersion = getHttpVersion(settings.preferredHttpVersion);
    debugTimeline.push({
      name: 'TEXT',
      value: httpVersion.log,
      timestamp: Date.now(),
    });
    if (httpVersion.curlHttpVersion) curl.setOpt(Curl.option.HTTP_VERSION, httpVersion.curlHttpVersion);

    // Set follow redirects setting
    const on = renderedRequest.settingFollowRedirects === 'on';
    const off = renderedRequest.settingFollowRedirects === 'off';
    if (off) curl.setOpt(Curl.option.FOLLOWLOCATION, false);
    else if (on) curl.setOpt(Curl.option.FOLLOWLOCATION, true);
    else curl.setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects);

    // Set maximum amount of redirects allowed
    // NOTE: Setting this to -1 breaks some versions of libcurl
    if (settings.maxRedirects > 0) curl.setOpt(Curl.option.MAXREDIRS, settings.maxRedirects);

    // Don't rebuild dot sequences in path
    if (!renderedRequest.settingRebuildPath) curl.setOpt(Curl.option.PATH_AS_IS, true);

    // Only set CURLOPT_CUSTOMREQUEST if not HEAD or GET. This is because Curl
    // See https://curl.haxx.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html
    // This is how you tell Curl to send a HEAD request
    if (renderedRequest.method.toUpperCase() === 'HEAD') curl.setOpt(Curl.option.NOBODY, 1);
    // This is how you tell Curl to send a POST request
    else if (renderedRequest.method.toUpperCase() === 'POST') curl.setOpt(Curl.option.POST, 1);
    // IMPORTANT: Only use CUSTOMREQUEST for all but HEAD and POST
    else curl.setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);

    if (renderedRequest.authentication.type === AUTH_NETRC) {
      curl.setOpt(Curl.option.NETRC, CurlNetrc.Required);
    }
    // Set proxy settings if we have them
    if (!settings.proxyEnabled) curl.setOpt(Curl.option.PROXY, '');
    else {
      const { protocol } = urlParse(renderedRequest.url);
      const { httpProxy, httpsProxy, noProxy } = settings;
      const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
      const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
      debugTimeline.push({
        name: 'TEXT',
        value: `Enable network proxy for ${protocol || ''}`,
        timestamp: Date.now(),
      });
      if (proxy) {
        curl.setOpt(Curl.option.PROXY, proxy);
        curl.setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
      }
      if (noProxy) curl.setOpt(Curl.option.NOPROXY, noProxy);
    }

    if (settings.timeout <= 0) curl.setOpt(Curl.option.TIMEOUT_MS, 0);
    else {
      curl.setOpt(Curl.option.TIMEOUT_MS, settings.timeout);
      debugTimeline.push({
        name: 'TEXT',
        value: `Enable timeout of ${settings.timeout}ms`,
        timestamp: Date.now(),
      });
    }

    if (!settings.validateSSL) {
      curl.setOpt(Curl.option.SSL_VERIFYHOST, 0);
      curl.setOpt(Curl.option.SSL_VERIFYPEER, 0);
    }
    debugTimeline.push({
      name: 'TEXT',
      value: `${settings.validateSSL ? 'Enable' : 'Disable'} SSL validation`,
      timestamp: Date.now(),
    });

    // Set User-Agent if it's not already in headers
    if (!hasUserAgentHeader(renderedRequest.headers)) {
      curl.setOpt(Curl.option.USERAGENT, `insomnia/${version}`);
    }
    if (renderedRequest.settingSendCookies) {
      // Tell Curl to store cookies that it receives. This is only important if we receive
      // a cookie on a redirect that needs to be sent on the next request in the chain.
      curl.setOpt(Curl.option.COOKIEFILE, '');
      const cookies = renderedRequest.cookieJar.cookies || [];

      for (const cookie of cookies) {
        curl.setOpt(
          Curl.option.COOKIELIST,
          [
            cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
            cookie.hostOnly ? 'FALSE' : 'TRUE',
            cookie.path,
            cookie.secure ? 'TRUE' : 'FALSE',
            cookie.expires ? Math.round(new Date(cookie.expires).getTime() / 1000) : 0,
            cookie.key,
            cookie.value,
          ].join('\t'),
        );
      }

      for (const { name, value } of renderedRequest.cookies) {
        curl.setOpt(Curl.option.COOKIE, `${name}=${value}`);
      }
      debugTimeline.push({
        name: 'TEXT',
        value: `Enable cookie sending with jar of ${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}`,
        timestamp: Date.now(),
      });
    }

    const requestBody = parseRequestBody(renderedRequest);
    if (requestBody) curl.setOpt(Curl.option.POSTFIELDS, requestBody);
    const requestBodyPath = await parseRequestBodyPath(renderedRequest);
    let isMultipart = false;
    if (requestBodyPath) {
      // AWS IAM file upload not supported
      if (renderedRequest.authentication.type === AUTH_AWS_IAM) throw new Error('AWS authentication not supported for provided body type');
      isMultipart = renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath;
      const { size: contentLength } = fs.statSync(requestBodyPath);
      curl.setOpt(Curl.option.INFILESIZE_LARGE, contentLength);
      curl.setOpt(Curl.option.UPLOAD, 1);
      // We need this, otherwise curl will send it as a POST
      curl.setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);
    }
    const headerStrings = await parseHeaderStrings({ renderedRequest, requestBody, requestBodyPath, finalUrl });
    curl.setOpt(Curl.option.HTTPHEADER, headerStrings);

    const { username, password, disabled } = renderedRequest.authentication;
    const isDigest = renderedRequest.authentication.type === AUTH_DIGEST;
    const isNLTM = renderedRequest.authentication.type === AUTH_NTLM;
    const isDigestOrNLTM = isDigest || isNLTM;
    if (!hasAuthHeader(renderedRequest.headers) && !disabled && isDigestOrNLTM) {
      isDigest && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Digest);
      isNLTM && curl.setOpt(Curl.option.HTTPAUTH, CurlAuth.Ntlm);
      curl.setOpt(Curl.option.USERNAME, username || '');
      curl.setOpt(Curl.option.PASSWORD, password || '');
    }

    let requestFileDescriptor;
    const responseBodyWriteStream = fs.createWriteStream(responseBodyPath);
    // cancel request by id map
    cancelCurlRequestHandlers[requestId] = () => {
      if (requestFileDescriptor && responseBodyPath) {
        closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath);
      }
      curl.close();
    };
    // set the string and number options from network.ts
    curlOptions.forEach(opt => curl.setOpt(opt.key, opt.value));
    // read file into request and close file desriptor
    if (requestBodyPath) {
      requestFileDescriptor = fs.openSync(requestBodyPath, 'r');
      curl.setOpt(Curl.option.READDATA, requestFileDescriptor);
      curl.on('end', () => closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath));
      curl.on('error', () => closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath));
    }

    // set up response writer
    let responseBodyBytes = 0;
    curl.setOpt(Curl.option.WRITEFUNCTION, buffer => {
      responseBodyBytes += buffer.length;
      responseBodyWriteStream.write(buffer);
      return buffer.length;
    });
    // set up response logger
    curl.setOpt(Curl.option.DEBUGFUNCTION, (infoType, buffer) => {
      const rawName = Object.keys(CurlInfoDebug).find(k => CurlInfoDebug[k] === infoType) || '';
      const infoTypeName = LIBCURL_DEBUG_MIGRATION_MAP[rawName] || rawName;

      const isSSLData = infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut;
      const isEmpty = buffer.length === 0;
      // Don't show cookie setting because this will display every domain in the jar
      const isAddCookie = infoType === CurlInfoDebug.Text && buffer.toString('utf8').indexOf('Added cookie') === 0;
      if (isSSLData || isEmpty || isAddCookie) {
        return 0;
      }

      let value;
      if (infoType === CurlInfoDebug.DataOut) {
        // Ignore large post data messages
        const isLessThan10KB = buffer.length / 1024 < (settings.maxTimelineDataSizeKB || 1);
        value = isLessThan10KB ? buffer.toString('utf8') : `(${describeByteSize(buffer.length)} hidden)`;
      }
      if (infoType === CurlInfoDebug.DataIn) {
        value = `Received ${describeByteSize(buffer.length)} chunk`;
      }

      debugTimeline.push({
        name: infoType === CurlInfoDebug.DataIn ? 'TEXT' : infoTypeName,
        value: value || buffer.toString('utf8'),
        timestamp: Date.now(),
      });
      return 0; // Must be here
    });

    // makes rawHeaders a buffer, rather than HeaderInfo[]
    curl.enable(CurlFeature.Raw);
    // NOTE: legacy write end callback
    curl.on('end', () => responseBodyWriteStream.end());
    curl.on('end', async (_1, _2, rawHeaders: Buffer) => {
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
    curl.on('error', async function(err, code) {
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
  } catch (e) {
    const patch = {
      statusMessage: 'Error',
      error: e.message || 'Something went wrong',
      elapsedTime: 0,
    };
    resolve({ patch, debugTimeline: [], headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
  }
});

const closeReadFunction = (fd: number, isMultipart: boolean, path?: string) => {
  fs.closeSync(fd);
  // NOTE: multipart files are combined before sending, so this file is deleted after
  // alt implemention to send one part at a time https://github.com/JCMais/node-libcurl/blob/develop/examples/04-multi.js
  if (isMultipart && path) {
    fs.unlink(path, () => { });
  }
};

// Because node-libcurl changed some names that we used in the timeline
const LIBCURL_DEBUG_MIGRATION_MAP = {
  HeaderIn: 'HEADER_IN',
  DataIn: 'DATA_IN',
  SslDataIn: 'SSL_DATA_IN',
  HeaderOut: 'HEADER_OUT',
  DataOut: 'DATA_OUT',
  SslDataOut: 'SSL_DATA_OUT',
  Text: 'TEXT',
  '': '',
};

interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}
// NOTE: legacy, has tests, could be simplified
export function _parseHeaders(buffer: Buffer) {
  const results: HeaderResult[] = [];
  const lines = buffer.toString('utf8').split(/\r?\n|\r/g);

  for (let i = 0, currentResult: HeaderResult | null = null; i < lines.length; i++) {
    const line = lines[i];
    const isEmptyLine = line.trim() === '';

    // If we hit an empty line, start parsing the next response
    if (isEmptyLine && currentResult) {
      results.push(currentResult);
      currentResult = null;
      continue;
    }

    if (!currentResult) {
      const [version, code, ...other] = line.split(/ +/g);
      currentResult = {
        version,
        code: parseInt(code, 10),
        reason: other.join(' '),
        headers: [],
      };
    } else {
      const [name, value] = line.split(/:\s(.+)/);
      const header: ResponseHeader = {
        name,
        value: value || '',
      };
      currentResult.headers.push(header);
    }
  }

  return results;
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
const parseRequestBody = req => {
  const isUrlEncodedForm = req.body.mimeType === CONTENT_TYPE_FORM_URLENCODED;
  const expectsBody = ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase());
  const hasMimetypeAndUpdateMethod = typeof req.body.mimeType === 'string' || expectsBody;
  if (isUrlEncodedForm) {
    const urlSearchParams = new URLSearchParams();
    req.body.params.map(p => urlSearchParams.append(p.name, p?.value || ''));
    return urlSearchParams.toString();
  }
  if (hasMimetypeAndUpdateMethod) {
    return req.body.text;
  }
};
export const HttpVersions = {
  V1_0: 'V1_0',
  V1_1: 'V1_1',
  V2PriorKnowledge: 'V2PriorKnowledge',
  V2_0: 'V2_0',
  v3: 'v3',
  default: 'default',
} as const;
export const getHttpVersion = preferredHttpVersion => {
  switch (preferredHttpVersion) {
    case HttpVersions.V1_0:
      return { log: 'Using HTTP 1.0', curlHttpVersion: CurlHttpVersion.V1_0 };
    case HttpVersions.V1_1:
      return { log: 'Using HTTP 1.1', curlHttpVersion: CurlHttpVersion.V1_1 };
    case HttpVersions.V2PriorKnowledge:
      return { log: 'Using HTTP/2 PriorKnowledge', curlHttpVersion: CurlHttpVersion.V2PriorKnowledge };
    case HttpVersions.V2_0:
      return { log: 'Using HTTP/2', curlHttpVersion: CurlHttpVersion.V2_0 };
    case HttpVersions.v3:
      return { log: 'Using HTTP/3', curlHttpVersion: CurlHttpVersion.v3 };
    case HttpVersions.default:
      return { log: 'Using default HTTP version' };
    default:
      return { log: `Unknown HTTP version specified ${preferredHttpVersion}` };
  }
};
export const setDefaultProtocol = (url: string, defaultProto?: string) => {
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
const parseRequestBodyPath = async req => {
  const isMultipartForm = req.body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (isMultipartForm) {
    const { filePath } = await buildMultipart(req.body.params || [],);
    return filePath;
  }
  return req.body.fileName;
};
