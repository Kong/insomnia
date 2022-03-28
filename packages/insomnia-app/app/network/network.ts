import { CurlAuth } from '@getinsomnia/node-libcurl/dist/enum/CurlAuth';
import { CurlHttpVersion } from '@getinsomnia/node-libcurl/dist/enum/CurlHttpVersion';
import { CurlNetrc } from '@getinsomnia/node-libcurl/dist/enum/CurlNetrc';
import aws4 from 'aws4';
import clone from 'clone';
import fs from 'fs';
import { HttpVersions } from 'insomnia-common';
import { cookiesFromJar, jarFromCookies } from 'insomnia-cookies';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  setDefaultProtocol,
  smartEncodeUrl,
} from 'insomnia-url';
import mkdirp from 'mkdirp';
import { join as pathJoin } from 'path';
import { parse as urlParse } from 'url';
import { v4 as uuidv4 } from 'uuid';

import {
  AUTH_AWS_IAM,
  AUTH_DIGEST,
  AUTH_NETRC,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  getAppVersion,
  STATUS_CODE_PLUGIN_ERROR,
} from '../common/constants';
import { database as db } from '../common/database';
import { getDataDirectory, getTempDir } from '../common/electron-helpers';
import {
  delay,
  getContentTypeHeader,
  getHostHeader,
  getLocationHeader,
  getSetCookieHeaders,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
  hasUserAgentHeader,
  LIBCURL_DEBUG_MIGRATION_MAP,
} from '../common/misc';
import type { ExtraRenderInfo, RenderedRequest } from '../common/render';
import {
  getRenderedRequestAndContext,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../common/render';
import * as models from '../models';
import { ClientCertificate } from '../models/client-certificate';
import type { Request, RequestHeader } from '../models/request';
import type { ResponseHeader, ResponseTimelineEntry } from '../models/response';
import type { Settings } from '../models/settings';
import { isWorkspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { getAuthHeader } from './authentication';
import caCerts from './ca_certs';
import { buildMultipart, DEFAULT_BOUNDARY } from './multipart';
import { urlMatchesCertHost } from './url-matches-cert-host';

// Based on list of option properties but with callback options removed
const Curl = {
  option: {
    ACCEPT_ENCODING: 'ACCEPT_ENCODING',
    CAINFO: 'CAINFO',
    COOKIE: 'COOKIE',
    COOKIEFILE: 'COOKIEFILE',
    COOKIELIST: 'COOKIELIST',
    CUSTOMREQUEST: 'CUSTOMREQUEST',
    FOLLOWLOCATION: 'FOLLOWLOCATION',
    HTTPAUTH: 'HTTPAUTH',
    HTTPGET: 'HTTPGET',
    HTTPHEADER: 'HTTPHEADER',
    HTTPPOST: 'HTTPPOST',
    HTTP_VERSION: 'HTTP_VERSION',
    INFILESIZE_LARGE: 'INFILESIZE_LARGE',
    KEYPASSWD: 'KEYPASSWD',
    MAXREDIRS: 'MAXREDIRS',
    NETRC: 'NETRC',
    NOBODY: 'NOBODY',
    NOPROGRESS: 'NOPROGRESS',
    NOPROXY: 'NOPROXY',
    PASSWORD: 'PASSWORD',
    POST: 'POST',
    POSTFIELDS: 'POSTFIELDS',
    PATH_AS_IS: 'PATH_AS_IS',
    PROXY: 'PROXY',
    PROXYAUTH: 'PROXYAUTH',
    SSLCERT: 'SSLCERT',
    SSLCERTTYPE: 'SSLCERTTYPE',
    SSLKEY: 'SSLKEY',
    SSL_VERIFYHOST: 'SSL_VERIFYHOST',
    SSL_VERIFYPEER: 'SSL_VERIFYPEER',
    TIMEOUT_MS: 'TIMEOUT_MS',
    UNIX_SOCKET_PATH: 'UNIX_SOCKET_PATH',
    UPLOAD: 'UPLOAD',
    URL: 'URL',
    USERAGENT: 'USERAGENT',
    USERNAME: 'USERNAME',
    VERBOSE: 'VERBOSE',
  },
};
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

// Time since user's last keypress to wait before making the request
const MAX_DELAY_TIME = 1000;

// Special header value that will prevent the header being sent
const DISABLE_HEADER_VALUE = '__Di$aB13d__';

const cancelRequestFunctionMap = {};

let lastUserInteraction = Date.now();

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

export async function cancelRequestById(requestId) {
  const hasCancelFunction = cancelRequestFunctionMap.hasOwnProperty(requestId) && typeof cancelRequestFunctionMap[requestId] === 'function';
  if (hasCancelFunction) {
    return cancelRequestFunctionMap[requestId]();
  }
  console.log(`[network] Failed to cancel req=${requestId} because cancel function not found`);
}

export async function _actuallySend(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  settings: Settings,
) {
  return new Promise<ResponsePatch>(async resolve => {
    const timeline: ResponseTimelineEntry[] = [];

    const addTimelineItem = (name: ResponseTimelineEntry['name']) => (value: string) => {
      timeline.push({
        name,
        value,
        timestamp: Date.now(),
      });
    };

    const addTimelineText = addTimelineItem(LIBCURL_DEBUG_MIGRATION_MAP.Text);

    // NOTE: can have duplicate keys because of cookie options
    const curlOptions: { key: string; value: string | string[] | number | boolean }[] = [];
    const setOpt = (key: string, value: string | string[] | number | boolean) => {
      curlOptions.push({ key, value });
    };

    try {
      // Setup the cancellation logic
      cancelRequestFunctionMap[renderedRequest._id] = async () => {
        const timelinePath = await storeTimeline(timeline);
        // Tear Down the cancellation logic
        if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
          delete cancelRequestFunctionMap[renderedRequest._id];
        }
        // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
        const nodejsCancelCurlRequest = process.type === 'renderer'
          ? window.main.cancelCurlRequest
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          : require('./libcurl-promise').cancelCurlRequest;
        nodejsCancelCurlRequest(renderedRequest._id);
        return resolve({
          elapsedTime: 0,
          bytesRead: 0,
          url: renderedRequest.url,
          statusMessage: 'Cancelled',
          error: 'Request was cancelled',
          timelinePath,
        });
      };

      // Set all the basic options
      setOpt(Curl.option.VERBOSE, true);

      // True so debug function works\
      setOpt(Curl.option.NOPROGRESS, true);

      // True so curl doesn't print progress
      setOpt(Curl.option.ACCEPT_ENCODING, '');

      // Set follow redirects setting
      switch (renderedRequest.settingFollowRedirects) {
        case 'off':
          setOpt(Curl.option.FOLLOWLOCATION, false);
          break;

        case 'on':
          setOpt(Curl.option.FOLLOWLOCATION, true);
          break;

        default:
          // Set to global setting
          setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects);
          break;
      }

      // Set maximum amount of redirects allowed
      // NOTE: Setting this to -1 breaks some versions of libcurl
      if (settings.maxRedirects > 0) {
        setOpt(Curl.option.MAXREDIRS, settings.maxRedirects);
      }

      // Don't rebuild dot sequences in path
      if (!renderedRequest.settingRebuildPath) {
        setOpt(Curl.option.PATH_AS_IS, true);
      }

      // Only set CURLOPT_CUSTOMREQUEST if not HEAD or GET. This is because Curl
      // See https://curl.haxx.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html
      switch (renderedRequest.method.toUpperCase()) {
        case 'HEAD':
          // This is how you tell Curl to send a HEAD request
          setOpt(Curl.option.NOBODY, 1);
          break;

        case 'POST':
          // This is how you tell Curl to send a POST request
          setOpt(Curl.option.POST, 1);
          break;

        default:
          // IMPORTANT: Only use CUSTOMREQUEST for all but HEAD and POST
          setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);
          break;
      }

      // Set the URL, including the query parameters
      const qs = buildQueryStringFromParams(renderedRequest.parameters);
      const url = joinUrlAndQueryString(renderedRequest.url, qs);
      const isUnixSocket = url.match(/https?:\/\/unix:\//);
      const finalUrl = smartEncodeUrl(url, renderedRequest.settingEncodeUrl);

      if (isUnixSocket) {
        // URL prep will convert "unix:/path" hostname to "unix/path"
        const match = finalUrl.match(/(https?:)\/\/unix:?(\/[^:]+):\/(.+)/);
        const protocol = (match && match[1]) || '';
        const socketPath = (match && match[2]) || '';
        const socketUrl = (match && match[3]) || '';
        setOpt(Curl.option.URL, `${protocol}//${socketUrl}`);
        setOpt(Curl.option.UNIX_SOCKET_PATH, socketPath);
      } else {
        setOpt(Curl.option.URL, finalUrl);
      }

      addTimelineText('Preparing request to ' + finalUrl);
      addTimelineText('Current time is ' + new Date().toISOString());

      const httpVersion = getHttpVersion(settings.preferredHttpVersion);
      addTimelineText(httpVersion.log);
      if (httpVersion.curlHttpVersion) {
        // Set HTTP version
        setOpt(Curl.option.HTTP_VERSION, httpVersion.curlHttpVersion);
      }

      // Set timeout
      if (settings.timeout > 0) {
        addTimelineText(`Enable timeout of ${settings.timeout}ms`);
        setOpt(Curl.option.TIMEOUT_MS, settings.timeout);
      } else {
        addTimelineText('Disable timeout');
        setOpt(Curl.option.TIMEOUT_MS, 0);
      }

      // log some things
      if (renderedRequest.settingEncodeUrl) {
        addTimelineText('Enable automatic URL encoding');
      } else {
        addTimelineText('Disable automatic URL encoding');
      }

      // SSL Validation
      if (settings.validateSSL) {
        addTimelineText('Enable SSL validation');
      } else {
        setOpt(Curl.option.SSL_VERIFYHOST, 0);
        setOpt(Curl.option.SSL_VERIFYPEER, 0);
        addTimelineText('Disable SSL validation');
      }

      // Setup CA Root Certificates
      const baseCAPath = getTempDir();
      const fullCAPath = pathJoin(baseCAPath, 'ca-certs.pem');

      try {
        fs.statSync(fullCAPath);
      } catch (err) {
        // Doesn't exist yet, so write it
        mkdirp.sync(baseCAPath);
        // TODO: Should mock cacerts module for testing.
        // This is literally coercing a function to string in tests due to lack of val-loader.
        fs.writeFileSync(fullCAPath, String(caCerts));
        console.log('[net] Set CA to', fullCAPath);
      }

      setOpt(Curl.option.CAINFO, fullCAPath);

      // Set cookies from jar
      if (renderedRequest.settingSendCookies) {
        // Tell Curl to store cookies that it receives. This is only important if we receive
        // a cookie on a redirect that needs to be sent on the next request in the chain.
        setOpt(Curl.option.COOKIEFILE, '');
        const cookies = renderedRequest.cookieJar.cookies || [];

        for (const cookie of cookies) {
          let expiresTimestamp = 0;

          if (cookie.expires) {
            const expiresDate = new Date(cookie.expires);
            expiresTimestamp = Math.round(expiresDate.getTime() / 1000);
          }

          setOpt(
            Curl.option.COOKIELIST,
            [
              cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
              cookie.hostOnly ? 'FALSE' : 'TRUE',
              cookie.path,
              cookie.secure ? 'TRUE' : 'FALSE',
              expiresTimestamp,
              cookie.key,
              cookie.value,
            ].join('\t'),
          );
        }

        for (const { name, value } of renderedRequest.cookies) {
          setOpt(Curl.option.COOKIE, `${name}=${value}`);
        }

        addTimelineText(
          `Enable cookie sending with jar of ${cookies.length} cookie${cookies.length !== 1 ? 's' : ''
          }`,
        );
      } else {
        addTimelineText('Disable cookie sending due to user setting');
      }

      // Set proxy settings if we have them
      if (settings.proxyEnabled) {
        const { protocol } = urlParse(renderedRequest.url);
        const { httpProxy, httpsProxy, noProxy } = settings;
        const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
        const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
        addTimelineText(`Enable network proxy for ${protocol || ''}`);

        if (proxy) {
          setOpt(Curl.option.PROXY, proxy);
          setOpt(Curl.option.PROXYAUTH, CurlAuth.Any);
        }

        if (noProxy) {
          setOpt(Curl.option.NOPROXY, noProxy);
        }
      } else {
        setOpt(Curl.option.PROXY, '');
      }

      for (const certificate of (clientCertificates || [])) {
        if (certificate.disabled) {
          continue;
        }

        const cHostWithProtocol = setDefaultProtocol(certificate.host, 'https:');

        if (urlMatchesCertHost(cHostWithProtocol, renderedRequest.url)) {
          const ensureFile = blobOrFilename => {
            try {
              fs.statSync(blobOrFilename);
            } catch (err) {
              // Certificate file not found!
              // LEGACY: Certs used to be stored in blobs (not as paths), so let's write it to
              // the temp directory first.
              const fullBase = getTempDir();
              const name = `${renderedRequest._id}_${renderedRequest.modified}`;
              const fullPath = pathJoin(fullBase, name);
              fs.writeFileSync(fullPath, Buffer.from(blobOrFilename, 'base64'));
              // Set filename to the one we just saved
              blobOrFilename = fullPath;
            }

            return blobOrFilename;
          };

          const { passphrase, cert, key, pfx } = certificate;

          if (cert) {
            setOpt(Curl.option.SSLCERT, ensureFile(cert));
            setOpt(Curl.option.SSLCERTTYPE, 'PEM');
            addTimelineText('Adding SSL PEM certificate');
          }

          if (pfx) {
            setOpt(Curl.option.SSLCERT, ensureFile(pfx));
            setOpt(Curl.option.SSLCERTTYPE, 'P12');
            addTimelineText('Adding SSL P12 certificate');
          }

          if (key) {
            setOpt(Curl.option.SSLKEY, ensureFile(key));
            addTimelineText('Adding SSL KEY certificate');
          }

          if (passphrase) {
            setOpt(Curl.option.KEYPASSWD, passphrase);
          }
        }
      }
      const requestBody = parseRequestBody(renderedRequest);
      if (requestBody) {
        setOpt(Curl.option.POSTFIELDS, requestBody);
      }
      const  requestBodyPath  = await parseRequestBodyPath(renderedRequest);
      if (requestBodyPath) {
        const { size: contentLength } = fs.statSync(requestBodyPath);
        setOpt(Curl.option.INFILESIZE_LARGE, contentLength);
        setOpt(Curl.option.UPLOAD, 1);
        // We need this, otherwise curl will send it as a POST
        setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);
      }
      // Handle Authorization header
      const { username, password, disabled } = renderedRequest.authentication;
      if (!hasAuthHeader(renderedRequest.headers) && !disabled) {
        if (renderedRequest.authentication.type === AUTH_DIGEST) {
          setOpt(Curl.option.HTTPAUTH, CurlAuth.Digest);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        }
        if (renderedRequest.authentication.type === AUTH_NTLM) {
          setOpt(Curl.option.HTTPAUTH, CurlAuth.Ntlm);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        }
        if (renderedRequest.authentication.type === AUTH_AWS_IAM) {
          // AWS IAM file upload not supported
          if (requestBodyPath) {
            const timelinePath = await storeTimeline(timeline);
            // Tear Down the cancellation logic
            if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
              delete cancelRequestFunctionMap[renderedRequest._id];
            }
            return resolve({
              url: renderedRequest.url,
              error: 'AWS authentication not supported for provided body type',
              elapsedTime: 0,
              statusMessage: 'Error',
              timelinePath,
            });
          }
        }
      }
      if (renderedRequest.authentication.type === AUTH_NETRC) {
        setOpt(Curl.option.NETRC, CurlNetrc.Required);
      }

      const headerStrings = await parseHeaderStrings({ renderedRequest, requestBody, requestBodyPath, finalUrl });
      setOpt(Curl.option.HTTPHEADER, headerStrings);

      // Set User-Agent if it's not already in headers
      if (!hasUserAgentHeader(renderedRequest.headers)) {
        setOpt(Curl.option.USERAGENT, `insomnia/${getAppVersion()}`);
      }

      const responsesDir = pathJoin(getDataDirectory(), 'responses');
      mkdirp.sync(responsesDir);
      const responseBodyPath = pathJoin(responsesDir, uuidv4() + '.response');
      // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
      const nodejsCurlRequest = process.type === 'renderer'
        ? window.main.curlRequest
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        : require('./libcurl-promise').curlRequest;
      const isMultipart = renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath;
      const requestOptions = {
        curlOptions,
        responseBodyPath,
        requestBodyPath,
        isMultipart,
        maxTimelineDataSizeKB: settings.maxTimelineDataSizeKB,
        requestId: renderedRequest._id,
      };
      const { patch, debugTimeline, headerResults } = await nodejsCurlRequest(requestOptions);
      const { cookieJar, settingStoreCookies } = renderedRequest;
      const { lastRedirect, contentType, headerTimeline } = await setCookiesFromResponseHeaders({
        headerResults,
        finalUrl,
        cookieJar,
        settingStoreCookies,
      });

      const responsePatch: ResponsePatch = {
        contentType,
        headers: lastRedirect.headers,
        httpVersion: lastRedirect.version,
        statusCode: lastRedirect.code,
        statusMessage: lastRedirect.reason,
        ...patch,
      };
      const timelinePath = await storeTimeline([...timeline, ...debugTimeline, ...headerTimeline]);
      // Tear Down the cancellation logic
      if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
        delete cancelRequestFunctionMap[renderedRequest._id];
      }
      return resolve({
        timelinePath,
        bodyPath: responseBodyPath,
        ...responsePatch,
      });
    } catch (err) {
      console.log('[network] Error', err);
      const timelinePath = await storeTimeline(timeline);
      // Tear Down the cancellation logic
      if (cancelRequestFunctionMap.hasOwnProperty(renderedRequest._id)) {
        delete cancelRequestFunctionMap[renderedRequest._id];
      }
      return resolve({
        url: renderedRequest.url,
        error: err.message || 'Something went wrong',
        elapsedTime: 0, // 0 because this path is hit during plugin calls
        statusMessage: 'Error',
        timelinePath,
      });
    }
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

const parseRequestBodyPath = async req => {
  const isMultipartForm = req.body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (isMultipartForm) {
    const { filePath } = await buildMultipart(req.body.params || [],);
    return filePath;
  }
  return req.body.fileName;
};

// add set-cookie headers to file(cookiejar) and database
const setCookiesFromResponseHeaders = async ({ headerResults, finalUrl, cookieJar, settingStoreCookies }) => {
  const headerTimeline: ResponseTimelineEntry[] = [];

  // Update Cookie Jar
  const setCookieStrings: string[] = headerResults.map(({ headers }) => getSetCookieHeaders(headers).map(s => s.value)).flat().filter(s => s.length);

  // Update jar with Set-Cookie headers
  const jar = jarFromCookies(cookieJar.cookies);
  for (const setCookie of setCookieStrings) {
    try {
      // get the last location header to set the cookie at
      const locationHeader = headerResults.reverse().find(({ headers }) => getLocationHeader(headers));
      jar.setCookieSync(setCookie, locationHeader?.value || finalUrl);
    } catch (err) {
      headerTimeline.push({
        name: 'TEXT',
        value: `Rejected cookie: ${err.message}`,
        timestamp: Date.now(),
      });
    }
  }

  // Update cookie jar if we need to and if we found any cookies
  if (settingStoreCookies && setCookieStrings.length) {
    const cookies = await cookiesFromJar(jar);
    await models.cookieJar.update(cookieJar, { cookies });
  }

  // Print informational message
  if (setCookieStrings.length > 0) {
    const n = setCookieStrings.length;
    const intent = settingStoreCookies ? 'Saved' : 'Ignored';
    const plural = `cookie${n === 1 ? '' : 's'}`;
    headerTimeline.push({
      name: 'TEXT',
      value: `${intent} ${n} ${plural}`,
      timestamp: Date.now(),
    });
  }
  // Headers are an array (one for each redirect)
  const lastRedirect = headerResults[headerResults.length - 1];
  return {
    lastRedirect,
    contentType: getContentTypeHeader(lastRedirect.headers)?.value || '',
    headerTimeline,
  };

};

const parseHeaderStrings = async ({ renderedRequest, requestBody, requestBodyPath, finalUrl }) => {
  const headers = clone(renderedRequest.headers);

  // Disable Expect and Transfer-Encoding headers when we have POST body/file
  const hasRequestBodyOrFilePath = requestBody || requestBodyPath;
  if (hasRequestBodyOrFilePath) {
    headers.push({
      name: 'Expect',
      value: DISABLE_HEADER_VALUE,
    });
    headers.push({
      name: 'Transfer-Encoding',
      value: DISABLE_HEADER_VALUE,
    });
  }

  const isDigest = renderedRequest.authentication.type === AUTH_DIGEST;
  const isNTLM = renderedRequest.authentication.type === AUTH_NTLM;
  const isAWSIAM = renderedRequest.authentication.type === AUTH_AWS_IAM;
  if (isAWSIAM) {
    const { authentication } = renderedRequest;
    const credentials = {
      accessKeyId: authentication.accessKeyId || '',
      secretAccessKey: authentication.secretAccessKey || '',
      sessionToken: authentication.sessionToken || '',
    };

    const extraHeaders = _getAwsAuthHeaders(
      credentials,
      headers,
      requestBody || '',
      finalUrl,
      renderedRequest.method,
      authentication.region || '',
      authentication.service || '',
    );

    for (const header of extraHeaders) {
      headers.push(header);
    }
  }
  const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest = !hasAuthHeader(headers) && !renderedRequest.authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;
  if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest) {
    const authHeader = await getAuthHeader(renderedRequest, finalUrl);

    if (authHeader) {
      headers.push({
        name: authHeader.name,
        value: authHeader.value,
      });
    }
  }
  const isMultipartForm = renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (isMultipartForm && requestBodyPath) {
    const contentTypeHeader = getContentTypeHeader(headers);
    if (contentTypeHeader) {
      contentTypeHeader.value = `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`;
    } else {
      headers.push({
        name: 'Content-Type',
        value: `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`,
      });
    }
  }
  // Send a default Accept headers of anything
  if (!hasAcceptHeader(headers)) {
    headers.push({
      name: 'Accept',
      value: '*/*',
    }); // Default to anything
  }

  // Don't auto-send Accept-Encoding header
  if (!hasAcceptEncodingHeader(headers)) {
    headers.push({
      name: 'Accept-Encoding',
      value: DISABLE_HEADER_VALUE,
    });
  }

  // Prevent curl from adding default content-type header
  if (!hasContentTypeHeader(headers)) {
    headers.push({
      name: 'content-type',
      value: DISABLE_HEADER_VALUE,
    });
  }

  return headers
    .filter(h => h.name)
    .map(h => {
      const value = h.value || '';

      if (value === '') {
      // Curl needs a semicolon suffix to send empty header values
        return `${h.name};`;
      } else if (value === DISABLE_HEADER_VALUE) {
      // Tell Curl NOT to send the header if value is null
        return `${h.name}:`;
      } else {
      // Send normal header value
        return `${h.name}: ${value}`;
      }
    });
};

export async function sendWithSettings(
  requestId: string,
  requestPatch: Record<string, any>,
) {
  console.log(`[network] Sending with settings req=${requestId}`);
  const request = await models.request.getById(requestId);

  if (!request) {
    throw new Error(`Failed to find request: ${requestId}`);
  }
  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
  ]);
  const workspaceDoc = ancestors.find(isWorkspace);
  const workspaceId = workspaceDoc ? workspaceDoc._id : 'n/a';
  const workspace = await models.workspace.getById(workspaceId);

  if (!workspace) {
    throw new Error(`Failed to find workspace for: ${requestId}`);
  }

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';
  const newRequest: Request = await models.initModel(models.request.type, requestPatch, {
    _id: request._id + '.other',
    parentId: request._id,
  });
  let renderResult: {
    request: RenderedRequest;
    context: Record<string, any>;
  };
  try {
    renderResult = await getRenderedRequestAndContext({ request: newRequest, environmentId });
  } catch (err) {
    throw new Error(`Failed to render request: ${requestId}`);
  }
  const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);
  const response = await _actuallySend(
    renderResult.request,
    clientCertificates,
    { ...settings, validateSSL: settings.validateAuthSSL },
  );
  response.parentId = renderResult.request._id;
  response.environmentId = environmentId;
  response.bodyCompression = null;
  response.settingSendCookies = renderResult.request.settingSendCookies;
  response.settingStoreCookies = renderResult.request.settingStoreCookies;
  if (response.error) {
    return response;
  }
  return _applyResponsePluginHooks(
    response,
    renderResult.request,
    renderResult.context,
  );
}

export async function send(
  requestId: string,
  environmentId?: string,
  extraInfo?: ExtraRenderInfo,
) {
  console.log(`[network] Sending req=${requestId} env=${environmentId || 'null'}`);
  // HACK: wait for all debounces to finish

  /*
   * TODO: Do this in a more robust way
   * The following block adds a "long" delay to let potential debounces and
   * database updates finish before making the request. This is done by tracking
   * the time of the user's last keypress and making sure the request is sent a
   * significant time after the last press.
   */
  const timeSinceLastInteraction = Date.now() - lastUserInteraction;
  const delayMillis = Math.max(0, MAX_DELAY_TIME - timeSinceLastInteraction);
  if (delayMillis > 0) {
    await delay(delayMillis);
  }

  // Fetch some things

  const request = await models.request.getById(requestId);
  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type,
  ]);

  if (!request) {
    throw new Error(`Failed to find request to send for ${requestId}`);
  }
  const renderResult = await getRenderedRequestAndContext(
    {
      request,
      environmentId,
      purpose: RENDER_PURPOSE_SEND,
      extraInfo,
    },
  );

  const renderedRequestBeforePlugins = renderResult.request;
  const renderedContextBeforePlugins = renderResult.context;
  const workspaceDoc = ancestors.find(isWorkspace);
  const workspace = await models.workspace.getById(workspaceDoc ? workspaceDoc._id : 'n/a');

  if (!workspace) {
    throw new Error(`Failed to find workspace for request: ${requestId}`);
  }

  let renderedRequest: RenderedRequest;

  try {
    renderedRequest = await _applyRequestPluginHooks(
      renderedRequestBeforePlugins,
      renderedContextBeforePlugins,
    );
  } catch (err) {
    return {
      environmentId: environmentId,
      error: err.message || 'Something went wrong',
      parentId: renderedRequestBeforePlugins._id,
      settingSendCookies: renderedRequestBeforePlugins.settingSendCookies,
      settingStoreCookies: renderedRequestBeforePlugins.settingStoreCookies,
      statusCode: STATUS_CODE_PLUGIN_ERROR,
      statusMessage: err.plugin ? `Plugin ${err.plugin.name}` : 'Plugin',
      url: renderedRequestBeforePlugins.url,
    } as ResponsePatch;
  }
  const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);
  const response = await _actuallySend(
    renderedRequest,
    clientCertificates,
    settings,
  );
  response.parentId = renderResult.request._id;
  response.environmentId = environmentId;
  response.bodyCompression = null;
  response.settingSendCookies = renderedRequest.settingSendCookies;
  response.settingStoreCookies = renderedRequest.settingStoreCookies;

  console.log(
    response.error
      ? `[network] Response failed req=${requestId} err=${response.error || 'n/a'}`
      : `[network] Response succeeded req=${requestId} status=${response.statusCode || '?'}`,
  );
  if (response.error) {
    return response;
  }
  return _applyResponsePluginHooks(
    response,
    renderedRequest,
    renderedContextBeforePlugins,
  );
}

async function _applyRequestPluginHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
) {
  const newRenderedRequest = clone(renderedRequest);

  for (const { plugin, hook } of await plugins.getRequestHooks()) {
    const context = {
      ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
      ...pluginContexts.data.init(renderedContext.getProjectId()),
      ...(pluginContexts.store.init(plugin) as Record<string, any>),
      ...(pluginContexts.request.init(newRenderedRequest, renderedContext) as Record<string, any>),
      ...(pluginContexts.network.init(renderedContext.getEnvironmentId()) as Record<string, any>),
    };

    try {
      await hook(context);
    } catch (err) {
      err.plugin = plugin;
      throw err;
    }
  }

  return newRenderedRequest;
}

async function _applyResponsePluginHooks(
  response: ResponsePatch,
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<ResponsePatch> {
  try {
    const newResponse = clone(response);
    const newRequest = clone(renderedRequest);

    for (const { plugin, hook } of await plugins.getResponseHooks()) {
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(renderedContext.getProjectId()),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.response.init(newResponse) as Record<string, any>),
        ...(pluginContexts.request.init(newRequest, renderedContext, true) as Record<string, any>),
        ...(pluginContexts.network.init(renderedContext.getEnvironmentId()) as Record<string, any>),
      };

      try {
        await hook(context);
      } catch (err) {
        err.plugin = plugin;
        throw err;
      }
    }

    return newResponse;
  } catch (err) {
    return {
      url: renderedRequest.url,
      error: `[plugin] Response hook failed plugin=${err.plugin.name} err=${err.message}`,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      statusMessage: 'Error',
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
    };
  }

}

// exported for unit tests only
export function _getAwsAuthHeaders(
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  },
  headers: RequestHeader[],
  body: string,
  url: string,
  method: string,
  region?: string,
  service?: string,
): {
  name: string;
  value: string;
}[] {
  const parsedUrl = urlParse(url);
  const contentTypeHeader = getContentTypeHeader(headers);
  // AWS uses host header for signing so prioritize that if the user set it manually
  const hostHeader = getHostHeader(headers);
  const host = hostHeader ? hostHeader.value : parsedUrl.host;
  const awsSignOptions: aws4.Request = {
    service,
    region,
    ...(host ? { host } : {}),
    body,
    method,
    ...(parsedUrl.path ? { path: parsedUrl.path } : {}),
    headers: contentTypeHeader ? { 'content-type': contentTypeHeader.value } : {},
  };
  const signature = aws4.sign(awsSignOptions, credentials);
  if (!signature.headers) {
    return [];
  }
  return Object.keys(signature.headers)
    .filter(name => name !== 'content-type') // Don't add this because we already have it
    .map(name => ({
      name,
      value: String(signature.headers?.[name]),
    }));
}

function storeTimeline(timeline: ResponseTimelineEntry[]) {
  const timelineStr = JSON.stringify(timeline, null, '\t');
  const timelineHash = uuidv4();
  const responsesDir = pathJoin(getDataDirectory(), 'responses');
  mkdirp.sync(responsesDir);
  const timelinePath = pathJoin(responsesDir, timelineHash + '.timeline');
  if (process.type === 'renderer') {
    return window.main.writeFile({ path: timelinePath, content: timelineStr });
  }
  return new Promise<string>((resolve, reject) => {
    fs.writeFile(timelinePath, timelineStr, err => {
      if (err != null) {
        return reject(err);
      }
      resolve(timelinePath);
    });
  });
}

if (global.document) {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    lastUserInteraction = Date.now();
  });
  document.addEventListener('paste', () => {
    lastUserInteraction = Date.now();
  });
}
