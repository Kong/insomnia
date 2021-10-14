import aws4 from 'aws4';
import clone from 'clone';
import crypto from 'crypto';
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
import {
  Curl,
  CurlAuth,
  CurlCode,
  CurlFeature,
  CurlHttpVersion,
  CurlInfoDebug,
  CurlNetrc,
} from 'node-libcurl';
import { join as pathJoin } from 'path';
import { parse as urlParse, resolve as urlResolve } from 'url';
import * as uuid from 'uuid';

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
  describeByteSize,
  getContentTypeHeader,
  getHostHeader,
  getLocationHeader,
  getSetCookieHeaders,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
  hasUserAgentHeader,
  waitForStreamToFinish,
} from '../common/misc';
import type { ExtraRenderInfo, RenderedRequest } from '../common/render';
import {
  getRenderedRequestAndContext,
  RENDER_PURPOSE_NO_RENDER,
  RENDER_PURPOSE_SEND,
} from '../common/render';
import * as models from '../models';
import type { Environment } from '../models/environment';
import type { Request, RequestHeader } from '../models/request';
import type { ResponseHeader, ResponseTimelineEntry } from '../models/response';
import type { Settings } from '../models/settings';
import { isWorkspace, Workspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context/index';
import * as plugins from '../plugins/index';
import { getAuthHeader } from './authentication';
import caCerts from './ca-certs';
import { buildMultipart } from './multipart';
import { urlMatchesCertHost } from './url-matches-cert-host';

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

const cancelRequestFunctionMap = {};

let lastUserInteraction = Date.now();

export async function cancelRequestById(requestId) {
  if (hasCancelFunctionForId(requestId)) {
    const cancelRequestFunction = cancelRequestFunctionMap[requestId];

    if (typeof cancelRequestFunction === 'function') {
      return cancelRequestFunction();
    }
  }

  console.log(`[network] Failed to cancel req=${requestId} because cancel function not found`);
}

function clearCancelFunctionForId(requestId) {
  if (hasCancelFunctionForId(requestId)) {
    delete cancelRequestFunctionMap[requestId];
  }
}

export function hasCancelFunctionForId(requestId) {
  return cancelRequestFunctionMap.hasOwnProperty(requestId);
}

export async function _actuallySend(
  renderedRequest: RenderedRequest,
  renderContext: Record<string, any>,
  workspace: Workspace,
  settings: Omit<Settings, 'validateSSL' | 'validateAuthSSL'>,
  environment?: Environment | null,
  validateSSL = true,
) {
  return new Promise<ResponsePatch>(async resolve => {
    const timeline: ResponseTimelineEntry[] = [];

    function addTimeline(name, value) {
      timeline.push({
        name,
        value,
        timestamp: Date.now(),
      });
    }

    function addTimelineText(value) {
      addTimeline('TEXT', value);
    }

    // Initialize the curl handle
    const curl = new Curl();

    /** Helper function to respond with a success */
    async function respond(
      patch: ResponsePatch,
      bodyPath: string | null,
      noPlugins = false,
    ) {
      const timelinePath = await storeTimeline(timeline);
      // Tear Down the cancellation logic
      clearCancelFunctionForId(renderedRequest._id);
      const environmentId = environment ? environment._id : null;
      const responsePatchBeforeHooks = Object.assign(
        {
          timelinePath,
          environmentId,
          parentId: renderedRequest._id,
          bodyCompression: null,
          // Will default to .zip otherwise
          bodyPath: bodyPath || '',
          settingSendCookies: renderedRequest.settingSendCookies,
          settingStoreCookies: renderedRequest.settingStoreCookies,
        } as ResponsePatch,
        patch,
      );

      if (noPlugins) {
        resolve(responsePatchBeforeHooks);
        return;
      }

      let responsePatch: ResponsePatch | null = null;

      try {
        responsePatch = await _applyResponsePluginHooks(
          responsePatchBeforeHooks,
          renderedRequest,
          renderContext,
        );
      } catch (err) {
        await handleError(
          new Error(`[plugin] Response hook failed plugin=${err.plugin.name} err=${err.message}`),
        );
        return;
      }

      resolve(responsePatch);
    }

    /** Helper function to respond with an error */
    async function handleError(err: Error) {
      await respond(
        {
          url: renderedRequest.url,
          parentId: renderedRequest._id,
          error: err.message,
          elapsedTime: 0, // 0 because this path is hit during plugin calls
          statusMessage: 'Error',
          settingSendCookies: renderedRequest.settingSendCookies,
          settingStoreCookies: renderedRequest.settingStoreCookies,
        },
        null,
        true,
      );
    }

    /** Helper function to set Curl options */
    const setOpt: typeof curl.setOpt = (opt: any, val: any) => {
      try {
        return curl.setOpt(opt, val);
      } catch (err) {
        const name = Object.keys(Curl.option).find(name => Curl.option[name] === opt);
        throw new Error(`${err.message} (${opt} ${name || 'n/a'})`);
      }
    };

    try {
      // Setup the cancellation logic
      cancelRequestFunctionMap[renderedRequest._id] = async () => {
        await respond(
          {
            elapsedTime: (curl.getInfo(Curl.info.TOTAL_TIME) as number || 0) * 1000,
            // @ts-expect-error -- needs generic
            bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
            // @ts-expect-error -- needs generic
            url: curl.getInfo(Curl.info.EFFECTIVE_URL),
            statusMessage: 'Cancelled',
            error: 'Request was cancelled',
          },
          null,
          true,
        );
        // Kill it!
        curl.close();
      };

      // Set all the basic options
      setOpt(Curl.option.VERBOSE, true);

      // True so debug function works\
      setOpt(Curl.option.NOPROGRESS, true);

      // True so curl doesn't print progress
      setOpt(Curl.option.ACCEPT_ENCODING, '');

      // Auto decode everything
      curl.enable(CurlFeature.Raw);

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

      // Setup debug handler
      setOpt(Curl.option.DEBUGFUNCTION, (infoType, contentBuffer) => {
        const content = contentBuffer.toString('utf8');
        const rawName = Object.keys(CurlInfoDebug).find(k => CurlInfoDebug[k] === infoType) || '';
        const name = LIBCURL_DEBUG_MIGRATION_MAP[rawName] || rawName;

        if (infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut) {
          return 0;
        }

        // Ignore the possibly large data messages
        if (infoType === CurlInfoDebug.DataOut) {
          if (contentBuffer.length === 0) {
            // Sometimes this happens, but I'm not sure why. Just ignore it.
          } else if (contentBuffer.length / 1024 < settings.maxTimelineDataSizeKB) {
            addTimeline(name, content);
          } else {
            addTimeline(name, `(${describeByteSize(contentBuffer.length)} hidden)`);
          }

          return 0;
        }

        if (infoType === CurlInfoDebug.DataIn) {
          addTimelineText(`Received ${describeByteSize(contentBuffer.length)} chunk`);
          return 0;
        }

        // Don't show cookie setting because this will display every domain in the jar
        if (infoType === CurlInfoDebug.Text && content.indexOf('Added cookie') === 0) {
          return 0;
        }

        addTimeline(name, content);
        return 0; // Must be here
      });
      // Set the headers (to be modified as we go)
      const headers = clone(renderedRequest.headers);
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
      addTimelineText(`Using ${Curl.getVersion()}`);

      // Set HTTP version
      switch (settings.preferredHttpVersion) {
        case HttpVersions.V1_0:
          addTimelineText('Using HTTP 1.0');
          setOpt(Curl.option.HTTP_VERSION, CurlHttpVersion.V1_0);
          break;

        case HttpVersions.V1_1:
          addTimelineText('Using HTTP 1.1');
          setOpt(Curl.option.HTTP_VERSION, CurlHttpVersion.V1_1);
          break;

        case HttpVersions.V2_0:
          addTimelineText('Using HTTP/2');
          setOpt(Curl.option.HTTP_VERSION, CurlHttpVersion.V2_0);
          break;

        case HttpVersions.v3:
          addTimelineText('Using HTTP/3');
          setOpt(Curl.option.HTTP_VERSION, CurlHttpVersion.v3);
          break;

        case HttpVersions.default:
          addTimelineText('Using default HTTP version');
          break;

        default:
          addTimelineText(`Unknown HTTP version specified ${settings.preferredHttpVersion}`);
          break;
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
      if (validateSSL) {
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
        // TODO: Should mock cacerts module for testing. This is literally
        // coercing a function to string in tests due to lack of val-loader.
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
          `Enable cookie sending with jar of ${cookies.length} cookie${
            cookies.length !== 1 ? 's' : ''
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

      // Set client certs if needed
      const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);

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

      // Build the body
      let noBody = false;
      let requestBody: string | null = null;
      const expectsBody = ['POST', 'PUT', 'PATCH'].includes(renderedRequest.method.toUpperCase());

      if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
        requestBody = buildQueryStringFromParams(renderedRequest.body.params || [], false);
      } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
        const params = renderedRequest.body.params || [];
        const { filePath: multipartBodyPath, boundary, contentLength } = await buildMultipart(
          params,
        );
        // Extend the Content-Type header
        const contentTypeHeader = getContentTypeHeader(headers);

        if (contentTypeHeader) {
          contentTypeHeader.value = `multipart/form-data; boundary=${boundary}`;
        } else {
          headers.push({
            name: 'Content-Type',
            value: `multipart/form-data; boundary=${boundary}`,
          });
        }

        const fd = fs.openSync(multipartBodyPath, 'r');
        setOpt(Curl.option.INFILESIZE_LARGE, contentLength);
        setOpt(Curl.option.UPLOAD, 1);
        setOpt(Curl.option.READDATA, fd);
        // We need this, otherwise curl will send it as a PUT
        setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);

        const fn = () => {
          fs.closeSync(fd);
          fs.unlink(multipartBodyPath, () => {
            // Pass
          });
        };

        curl.on('end', fn);
        curl.on('error', fn);
      } else if (renderedRequest.body.fileName) {
        const { size } = fs.statSync(renderedRequest.body.fileName);
        const fileName = renderedRequest.body.fileName || '';
        const fd = fs.openSync(fileName, 'r');
        setOpt(Curl.option.INFILESIZE_LARGE, size);
        setOpt(Curl.option.UPLOAD, 1);
        setOpt(Curl.option.READDATA, fd);
        // We need this, otherwise curl will send it as a POST
        setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);

        const fn = () => fs.closeSync(fd);

        curl.on('end', fn);
        curl.on('error', fn);
      } else if (typeof renderedRequest.body.mimeType === 'string' || expectsBody) {
        requestBody = renderedRequest.body.text || '';
      } else {
        // No body
        noBody = true;
      }

      if (!noBody) {
        // Don't chunk uploads
        headers.push({
          name: 'Expect',
          value: DISABLE_HEADER_VALUE,
        });
        headers.push({
          name: 'Transfer-Encoding',
          value: DISABLE_HEADER_VALUE,
        });
      }

      // If we calculated the body within Insomnia (ie. not computed by Curl)
      if (requestBody !== null) {
        setOpt(Curl.option.POSTFIELDS, requestBody);
      }

      // Handle Authorization header
      if (!hasAuthHeader(headers) && !renderedRequest.authentication.disabled) {
        if (renderedRequest.authentication.type === AUTH_DIGEST) {
          const { username, password } = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, CurlAuth.Digest);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_NTLM) {
          const { username, password } = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, CurlAuth.Ntlm);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_AWS_IAM) {
          if (!noBody && !requestBody) {
            return handleError(
              new Error('AWS authentication not supported for provided body type'),
            );
          }

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
        } else if (renderedRequest.authentication.type === AUTH_NETRC) {
          setOpt(Curl.option.NETRC, CurlNetrc.Required);
        } else {
          const authHeader = await getAuthHeader(renderedRequest, finalUrl);

          if (authHeader) {
            headers.push({
              name: authHeader.name,
              value: authHeader.value,
            });
          }
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

      // Set User-Agent if it's not already in headers
      if (!hasUserAgentHeader(headers)) {
        setOpt(Curl.option.USERAGENT, `insomnia/${getAppVersion()}`);
      }

      // Prevent curl from adding default content-type header
      if (!hasContentTypeHeader(headers)) {
        headers.push({
          name: 'content-type',
          value: DISABLE_HEADER_VALUE,
        });
      }

      // NOTE: This is last because headers might be modified multiple times
      const headerStrings = headers
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
      setOpt(Curl.option.HTTPHEADER, headerStrings);
      let responseBodyBytes = 0;
      const responsesDir = pathJoin(getDataDirectory(), 'responses');
      mkdirp.sync(responsesDir);
      const responseBodyPath = pathJoin(responsesDir, uuid.v4() + '.response');
      const responseBodyWriteStream = fs.createWriteStream(responseBodyPath);
      curl.on('end', () => responseBodyWriteStream.end());
      curl.on('error', () => responseBodyWriteStream.end());
      setOpt(Curl.option.WRITEFUNCTION, buff => {
        responseBodyBytes += buff.length;
        responseBodyWriteStream.write(buff);
        return buff.length;
      });
      // Handle the response ending
      curl.on('end', async (_1, _2, rawHeaders: Buffer) => {
        const allCurlHeadersObjects = _parseHeaders(rawHeaders);

        // Headers are an array (one for each redirect)
        const lastCurlHeadersObject = allCurlHeadersObjects[allCurlHeadersObjects.length - 1];
        // Collect various things
        const httpVersion = lastCurlHeadersObject.version || '';
        const statusCode = lastCurlHeadersObject.code || -1;
        const statusMessage = lastCurlHeadersObject.reason || '';
        // Collect the headers
        const headers = lastCurlHeadersObject.headers;
        // Calculate the content type
        const contentTypeHeader = getContentTypeHeader(headers);
        const contentType = contentTypeHeader ? contentTypeHeader.value : '';
        // Update Cookie Jar
        let currentUrl = finalUrl;
        let setCookieStrings: string[] = [];
        const jar = jarFromCookies(renderedRequest.cookieJar.cookies);

        for (const { headers } of allCurlHeadersObjects) {
          // Collect Set-Cookie headers
          const setCookieHeaders = getSetCookieHeaders(headers);
          setCookieStrings = [...setCookieStrings, ...setCookieHeaders.map(h => h.value)];
          // Pull out new URL if there is a redirect
          const newLocation = getLocationHeader(headers);

          if (newLocation !== null) {
            currentUrl = urlResolve(currentUrl, newLocation.value);
          }
        }

        // Update jar with Set-Cookie headers
        for (const setCookieStr of setCookieStrings) {
          try {
            jar.setCookieSync(setCookieStr, currentUrl);
          } catch (err) {
            addTimelineText(`Rejected cookie: ${err.message}`);
          }
        }

        // Update cookie jar if we need to and if we found any cookies
        if (renderedRequest.settingStoreCookies && setCookieStrings.length) {
          const cookies = await cookiesFromJar(jar);
          await models.cookieJar.update(renderedRequest.cookieJar, {
            cookies,
          });
        }

        // Print informational message
        if (setCookieStrings.length > 0) {
          const n = setCookieStrings.length;

          if (renderedRequest.settingStoreCookies) {
            addTimelineText(`Saved ${n} cookie${n === 1 ? '' : 's'}`);
          } else {
            addTimelineText(`Ignored ${n} cookie${n === 1 ? '' : 's'}`);
          }
        }

        // Return the response data
        const responsePatch: ResponsePatch = {
          contentType,
          headers,
          httpVersion,
          statusCode,
          statusMessage,
          bytesContent: responseBodyBytes,
          // @ts-expect-error -- TSCONVERSION appears to be a genuine error
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000,
          // @ts-expect-error -- TSCONVERSION appears to be a genuine error
          url: curl.getInfo(Curl.info.EFFECTIVE_URL),
        };
        // Close the request
        curl.close();
        // Make sure the response body has been fully written first
        await waitForStreamToFinish(responseBodyWriteStream);
        // Send response
        await respond(responsePatch, responseBodyPath);
      });
      curl.on('error', async function(err, code) {
        let error = err + '';
        let statusMessage = 'Error';

        if (code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
          error = 'Request aborted';
          statusMessage = 'Abort';
        }

        await respond(
          {
            statusMessage,
            error,
            elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000,
          },
          null,
          true,
        );
      });
      curl.perform();
    } catch (err) {
      console.log('[network] Error', err);
      await handleError(err);
    }
  });
}

export async function sendWithSettings(
  requestId: string,
  requestPatch: Record<string, any>,
) {
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
  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
  let renderResult: {
    request: RenderedRequest;
    context: Record<string, any>;
  };

  try {
    renderResult = await getRenderedRequestAndContext({ request: newRequest, environmentId });
  } catch (err) {
    throw new Error(`Failed to render request: ${requestId}`);
  }

  return _actuallySend(
    renderResult.request,
    renderResult.context,
    workspace,
    settings,
    environment,
    settings.validateAuthSSL,
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

  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
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
      error: err.message,
      parentId: renderedRequestBeforePlugins._id,
      settingSendCookies: renderedRequestBeforePlugins.settingSendCookies,
      settingStoreCookies: renderedRequestBeforePlugins.settingStoreCookies,
      statusCode: STATUS_CODE_PLUGIN_ERROR,
      statusMessage: err.plugin ? `Plugin ${err.plugin.name}` : 'Plugin',
      url: renderedRequestBeforePlugins.url,
    } as ResponsePatch;
  }

  const response = await _actuallySend(
    renderedRequest,
    renderedContextBeforePlugins,
    workspace,
    settings,
    environment,
    settings.validateSSL,
  );
  console.log(
    response.error
      ? `[network] Response failed req=${requestId} err=${response.error || 'n/a'}`
      : `[network] Response succeeded req=${requestId} status=${response.statusCode || '?'}`,
  );
  return response;
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
) {
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
}

interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}

export function _parseHeaders(
  buffer: Buffer,
) {
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
  description?: string;
  disabled?: boolean;
}[] {
  const parsedUrl = urlParse(url);
  const contentTypeHeader = getContentTypeHeader(headers);
  // AWS uses host header for signing so prioritize that if the user set it manually
  const hostHeader = getHostHeader(headers);
  const host = hostHeader ? hostHeader.value : parsedUrl.host;
  const awsSignOptions = {
    service,
    region,
    host,
    body,
    method,
    path: parsedUrl.path,
    headers: contentTypeHeader
      ? {
        'content-type': contentTypeHeader.value,
      }
      : {},
  };
  const signature = aws4.sign(awsSignOptions, credentials);
  return Object.keys(signature.headers)
    .filter(name => name !== 'content-type') // Don't add this because we already have it
    .map(name => ({
      name,
      value: signature.headers[name],
    }));
}

function storeTimeline(timeline: ResponseTimelineEntry[]) {
  return new Promise<string>((resolve, reject) => {
    const timelineStr = JSON.stringify(timeline, null, '\t');
    const timelineHash = crypto.createHash('sha1').update(timelineStr).digest('hex');
    const responsesDir = pathJoin(getDataDirectory(), 'responses');
    mkdirp.sync(responsesDir);
    const timelinePath = pathJoin(responsesDir, timelineHash + '.timeline');
    fs.writeFile(timelinePath, timelineStr, err => {
      if (err != null) {
        reject(err);
      } else {
        resolve(timelinePath);
      }
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
