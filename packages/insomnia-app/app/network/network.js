// @flow
import type { ResponseHeader, ResponseTimelineEntry } from '../models/response';
import type { Request, RequestHeader } from '../models/request';
import type { Workspace } from '../models/workspace';
import type { Settings } from '../models/settings';
import type { RenderedRequest } from '../common/render';
import { getRenderedRequestAndContext, RENDER_PURPOSE_SEND } from '../common/render';
import mkdirp from 'mkdirp';
import clone from 'clone';
import { parse as urlParse, resolve as urlResolve } from 'url';
import { Curl } from 'insomnia-libcurl';
import { join as pathJoin } from 'path';
import uuid from 'uuid';
import * as electron from 'electron';
import * as models from '../models';
import {
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_DIGEST,
  AUTH_NETRC,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  getAppVersion,
  getTempDir,
  STATUS_CODE_PLUGIN_ERROR
} from '../common/constants';
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
  waitForStreamToFinish
} from '../common/misc';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  setDefaultProtocol,
  smartEncodeUrl
} from 'insomnia-url';
import fs from 'fs';
import * as db from '../common/database';
import * as CACerts from './cacert';
import * as plugins from '../plugins/index';
import * as pluginContexts from '../plugins/context/index';
import { getAuthHeader } from './authentication';
import { cookiesFromJar, jarFromCookies } from 'insomnia-cookies';
import { urlMatchesCertHost } from './url-matches-cert-host';
import aws4 from 'aws4';
import { buildMultipart } from './multipart';

const { app } = electron.remote || electron;

export type ResponsePatch = {
  statusMessage?: string,
  error?: string,
  url?: string,
  statusCode?: number,
  bytesContent?: number,
  bodyPath?: string,
  bodyCompression?: 'zip' | null,
  message?: string,
  httpVersion?: string,
  headers?: Array<ResponseHeader>,
  elapsedTime?: number,
  contentType?: string,
  bytesRead?: number,
  parentId?: string,
  settingStoreCookies?: boolean,
  settingSendCookies?: boolean,
  timeline?: Array<ResponseTimelineEntry>
};

// Time since user's last keypress to wait before making the request
const MAX_DELAY_TIME = 1000;

// Special header value that will prevent the header being sent
const DISABLE_HEADER_VALUE = '__Di$aB13d__';

let cancelRequestFunction = null;
let lastUserInteraction = Date.now();

export function cancelCurrentRequest() {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
}

export async function _actuallySend(
  renderedRequest: RenderedRequest,
  renderContext: Object,
  workspace: Workspace,
  settings: Settings
): Promise<ResponsePatch> {
  return new Promise(async resolve => {
    let timeline: Array<ResponseTimelineEntry> = [];

    // Initialize the curl handle
    const curl = new Curl();

    /** Helper function to respond with a success */
    async function respond(
      patch: ResponsePatch,
      bodyPath: string | null,
      noPlugins: boolean = false
    ): Promise<void> {
      const responsePatchBeforeHooks = Object.assign(
        ({
          parentId: renderedRequest._id,
          bodyCompression: null, // Will default to .zip otherwise
          timeline: timeline,
          bodyPath: bodyPath || '',
          settingSendCookies: renderedRequest.settingSendCookies,
          settingStoreCookies: renderedRequest.settingStoreCookies
        }: ResponsePatch),
        patch
      );

      if (noPlugins) {
        resolve(responsePatchBeforeHooks);
        return;
      }

      let responsePatch: ?ResponsePatch;
      try {
        responsePatch = await _applyResponsePluginHooks(
          responsePatchBeforeHooks,
          renderedRequest,
          renderContext
        );
      } catch (err) {
        handleError(
          new Error(`[plugin] Response hook failed plugin=${err.plugin.name} err=${err.message}`)
        );
        return;
      }

      resolve(responsePatch);
    }

    /** Helper function to respond with an error */
    function handleError(err: Error): void {
      respond(
        {
          url: renderedRequest.url,
          parentId: renderedRequest._id,
          error: err.message,
          elapsedTime: 0,
          statusMessage: 'Error',
          settingSendCookies: renderedRequest.settingSendCookies,
          settingStoreCookies: renderedRequest.settingStoreCookies
        },
        null,
        true
      );
    }

    /** Helper function to set Curl options */
    function setOpt(opt: number, val: any, optional: boolean = false) {
      const name = Object.keys(Curl.option).find(name => Curl.option[name] === opt);
      try {
        curl.setOpt(opt, val);
      } catch (err) {
        if (!optional) {
          throw new Error(`${err.message} (${opt} ${name || 'n/a'})`);
        } else {
          console.warn(`Failed to set optional Curl opt (${opt} ${name || 'n/a'})`);
        }
      }
    }

    function enable(feature: number) {
      curl.enable(feature);
    }

    try {
      // Setup the cancellation logic
      cancelRequestFunction = () => {
        respond(
          {
            elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
            bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
            url: curl.getInfo(Curl.info.EFFECTIVE_URL),
            statusMessage: 'Cancelled',
            error: 'Request was cancelled'
          },
          null,
          true
        );

        // Kill it!
        curl.close();
      };

      // Set all the basic options
      setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects);
      setOpt(Curl.option.TIMEOUT_MS, settings.timeout); // 0 for no timeout
      setOpt(Curl.option.VERBOSE, true); // True so debug function works
      setOpt(Curl.option.NOPROGRESS, false); // False so progress function works
      setOpt(Curl.option.ACCEPT_ENCODING, ''); // Auto decode everything
      enable(Curl.feature.NO_HEADER_PARSING);
      enable(Curl.feature.NO_DATA_PARSING);

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
      setOpt(Curl.option.DEBUGFUNCTION, (infoType: string, content: string) => {
        const name = Object.keys(Curl.info.debug).find(k => Curl.info.debug[k] === infoType) || '';

        if (infoType === Curl.info.debug.SSL_DATA_IN || infoType === Curl.info.debug.SSL_DATA_OUT) {
          return 0;
        }

        // Ignore the possibly large data messages
        if (infoType === Curl.info.debug.DATA_OUT) {
          if (content.length === 0) {
            // Sometimes this happens, but I'm not sure why. Just ignore it.
          } else if (content.length < renderedRequest.settingMaxTimelineDataSize) {
            timeline.push({ name, value: content });
          } else {
            timeline.push({
              name,
              value: `(${describeByteSize(content.length)} hidden)`
            });
          }
          return 0;
        }

        if (infoType === Curl.info.debug.DATA_IN) {
          timeline.push({
            name: 'TEXT',
            value: `Received ${describeByteSize(content.length)} chunk`
          });
          return 0;
        }

        // Don't show cookie setting because this will display every domain in the jar
        if (infoType === Curl.info.debug.TEXT && content.indexOf('Added cookie') === 0) {
          return 0;
        }

        timeline.push({ name, value: content });

        return 0; // Must be here
      });

      // Set the headers (to be modified as we go)
      const headers = clone(renderedRequest.headers);

      let lastPercent = 0;
      // NOTE: This option was added in 7.32.0 so make it optional
      setOpt(
        Curl.option.XFERINFOFUNCTION,
        (dltotal, dlnow, ultotal, ulnow) => {
          if (dltotal === 0) {
            return 0;
          }

          const percent = Math.round((dlnow / dltotal) * 100);
          if (percent !== lastPercent) {
            // console.log(`[network] Request downloaded ${percent}%`);
            lastPercent = percent;
          }

          return 0;
        },
        true
      );

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
        curl.setUrl(`${protocol}//${socketUrl}`);
        setOpt(Curl.option.UNIX_SOCKET_PATH, socketPath);
      } else {
        curl.setUrl(finalUrl);
      }
      timeline.push({
        name: 'TEXT',
        value: 'Preparing request to ' + finalUrl
      });
      timeline.push({ name: 'TEXT', value: `Using ${Curl.getVersion()}` });

      // log some things
      if (renderedRequest.settingEncodeUrl) {
        timeline.push({ name: 'TEXT', value: 'Enable automatic URL encoding' });
      } else {
        timeline.push({
          name: 'TEXT',
          value: 'Disable automatic URL encoding'
        });
      }

      // SSL Validation
      if (settings.validateSSL) {
        timeline.push({ name: 'TEXT', value: 'Enable SSL validation' });
      } else {
        setOpt(Curl.option.SSL_VERIFYHOST, 0);
        setOpt(Curl.option.SSL_VERIFYPEER, 0);
        timeline.push({ name: 'TEXT', value: 'Disable SSL validation' });
      }

      // Setup CA Root Certificates if not on Mac. Thanks to libcurl, Mac will use
      // certificates form the OS.
      if (process.platform !== 'darwin') {
        const baseCAPath = getTempDir();
        const fullCAPath = pathJoin(baseCAPath, CACerts.filename);

        try {
          fs.statSync(fullCAPath);
        } catch (err) {
          // Doesn't exist yet, so write it
          mkdirp.sync(baseCAPath);
          fs.writeFileSync(fullCAPath, CACerts.blob);
          console.log('[net] Set CA to', fullCAPath);
        }

        setOpt(Curl.option.CAINFO, fullCAPath);
      }

      // Set cookies from jar
      if (renderedRequest.settingSendCookies) {
        // Tell Curl to store cookies that it receives. This is only important if we receive
        // a cookie on a redirect that needs to be sent on the next request in the chain.
        curl.setOpt(Curl.option.COOKIEFILE, '');

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
              cookie.value
            ].join('\t')
          );
        }

        for (const { name, value } of renderedRequest.cookies) {
          setOpt(Curl.option.COOKIE, `${name}=${value}`);
        }

        timeline.push({
          name: 'TEXT',
          value:
            'Enable cookie sending with jar of ' +
            `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}`
        });
      } else {
        timeline.push({
          name: 'TEXT',
          value: 'Disable cookie sending due to user setting'
        });
      }

      // Set proxy settings if we have them
      if (settings.proxyEnabled) {
        const { protocol } = urlParse(renderedRequest.url);
        const { httpProxy, httpsProxy, noProxy } = settings;
        const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
        const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
        timeline.push({
          name: 'TEXT',
          value: `Enable network proxy for ${protocol || ''}`
        });
        if (proxy) {
          setOpt(Curl.option.PROXY, proxy);
          setOpt(Curl.option.PROXYAUTH, Curl.auth.ANY);
        }
        if (noProxy) {
          setOpt(Curl.option.NOPROXY, noProxy);
        }
      } else {
        setOpt(Curl.option.PROXY, '');
      }

      // Set client certs if needed
      const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);
      for (const certificate of clientCertificates) {
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
            timeline.push({
              name: 'TEXT',
              value: 'Adding SSL PEM certificate'
            });
          }

          if (pfx) {
            setOpt(Curl.option.SSLCERT, ensureFile(pfx));
            setOpt(Curl.option.SSLCERTTYPE, 'P12');
            timeline.push({
              name: 'TEXT',
              value: 'Adding SSL P12 certificate'
            });
          }

          if (key) {
            setOpt(Curl.option.SSLKEY, ensureFile(key));
            timeline.push({
              name: 'TEXT',
              value: 'Adding SSL KEY certificate'
            });
          }

          if (passphrase) {
            setOpt(Curl.option.KEYPASSWD, passphrase);
          }
        }
      }

      // Build the body
      let noBody = false;
      let requestBody = null;
      const expectsBody = ['POST', 'PUT', 'PATCH'].includes(renderedRequest.method.toUpperCase());
      if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
        requestBody = buildQueryStringFromParams(renderedRequest.body.params || [], false);
      } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
        const params = renderedRequest.body.params || [];
        const { filePath: multipartBodyPath, boundary, contentLength } = await buildMultipart(
          params
        );

        // Extend the Content-Type header
        const contentTypeHeader = getContentTypeHeader(headers);
        if (contentTypeHeader) {
          contentTypeHeader.value = `multipart/form-data; boundary=${boundary}`;
        } else {
          headers.push({
            name: 'Content-Type',
            value: `multipart/form-data; boundary=${boundary}`
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
          fs.unlink(multipartBodyPath, () => {});
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
        headers.push({ name: 'Expect', value: DISABLE_HEADER_VALUE });
        headers.push({
          name: 'Transfer-Encoding',
          value: DISABLE_HEADER_VALUE
        });
      }

      // If we calculated the body within Insomnia (ie. not computed by Curl)
      if (requestBody !== null) {
        setOpt(Curl.option.POSTFIELDS, requestBody);
      }

      // Handle Authorization header
      if (!hasAuthHeader(headers) && !renderedRequest.authentication.disabled) {
        if (renderedRequest.authentication.type === AUTH_BASIC) {
          const { username, password } = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.BASIC);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_DIGEST) {
          const { username, password } = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.DIGEST);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_NTLM) {
          const { username, password } = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.NTLM);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_AWS_IAM) {
          if (!noBody && !requestBody) {
            return handleError(
              new Error('AWS authentication not supported for provided body type')
            );
          }
          const { authentication } = renderedRequest;
          const credentials = {
            accessKeyId: authentication.accessKeyId || '',
            secretAccessKey: authentication.secretAccessKey || '',
            sessionToken: authentication.sessionToken || ''
          };

          const extraHeaders = _getAwsAuthHeaders(
            credentials,
            headers,
            requestBody || '',
            finalUrl,
            renderedRequest.method,
            authentication.region || '',
            authentication.service || ''
          );

          for (const header of extraHeaders) {
            headers.push(header);
          }
        } else if (renderedRequest.authentication.type === AUTH_NETRC) {
          setOpt(Curl.option.NETRC, Curl.netrc.REQUIRED);
        } else {
          const authHeader = await getAuthHeader(
            renderedRequest._id,
            finalUrl,
            renderedRequest.method,
            renderedRequest.authentication
          );

          if (authHeader) {
            headers.push({
              name: authHeader.name,
              value: authHeader.value
            });
          }
        }
      }

      // Send a default Accept headers of anything
      if (!hasAcceptHeader(headers)) {
        headers.push({ name: 'Accept', value: '*/*' }); // Default to anything
      }

      // Don't auto-send Accept-Encoding header
      if (!hasAcceptEncodingHeader(headers)) {
        headers.push({ name: 'Accept-Encoding', value: DISABLE_HEADER_VALUE });
      }

      // Set User-Agent if it't not already in headers
      if (!hasUserAgentHeader(headers)) {
        setOpt(Curl.option.USERAGENT, `insomnia/${getAppVersion()}`);
      }

      // Prevent curl from adding default content-type header
      if (!hasContentTypeHeader(headers)) {
        headers.push({ name: 'content-type', value: DISABLE_HEADER_VALUE });
      }

      // NOTE: This is last because headers might be modified multiple times
      const headerStrings = headers.filter(h => h.name).map(h => {
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
      const responsesDir = pathJoin(app.getPath('userData'), 'responses');
      mkdirp.sync(responsesDir);
      const responseBodyPath = pathJoin(responsesDir, uuid.v4() + '.response');
      const responseBodyWriteStream = fs.createWriteStream(responseBodyPath);
      curl.on('end', () => responseBodyWriteStream.end());
      curl.on('error', () => responseBodyWriteStream.end());
      setOpt(Curl.option.WRITEFUNCTION, (buff: Buffer) => {
        responseBodyBytes += buff.length;
        responseBodyWriteStream.write(buff);
        return buff.length;
      });

      // Handle the response ending
      curl.on('end', async (_1, _2, rawHeaders) => {
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
        let setCookieStrings: Array<string> = [];
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
            timeline.push({
              name: 'TEXT',
              value: `Rejected cookie: ${err.message}`
            });
          }
        }

        // Update cookie jar if we need to and if we found any cookies
        if (renderedRequest.settingStoreCookies && setCookieStrings.length) {
          const cookies = await cookiesFromJar(jar);
          models.cookieJar.update(renderedRequest.cookieJar, { cookies });
        }

        // Print informational message
        if (setCookieStrings.length > 0) {
          const n = setCookieStrings.length;
          if (renderedRequest.settingStoreCookies) {
            timeline.push({
              name: 'TEXT',
              value: `Saved ${n} cookie${n === 1 ? '' : 's'}`
            });
          } else {
            timeline.push({
              name: 'TEXT',
              value: `Ignored ${n} cookie${n === 1 ? '' : 's'}`
            });
          }
        }

        // Return the response data
        const responsePatch = {
          headers,
          contentType,
          statusCode,
          httpVersion,
          statusMessage,
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          bytesContent: responseBodyBytes,
          url: curl.getInfo(Curl.info.EFFECTIVE_URL)
        };

        // Close the request
        curl.close();

        // Make sure the response body has been fully written first
        await waitForStreamToFinish(responseBodyWriteStream);

        respond(responsePatch, responseBodyPath);
      });

      curl.on('error', function(err, code) {
        let error = err + '';
        let statusMessage = 'Error';

        if (code === Curl.code.CURLE_ABORTED_BY_CALLBACK) {
          error = 'Request aborted';
          statusMessage = 'Abort';
        }

        respond({ statusMessage, error }, null, true);
      });

      curl.perform();
    } catch (err) {
      handleError(err);
    }
  });
}

export async function sendWithSettings(
  requestId: string,
  requestPatch: Object
): Promise<ResponsePatch> {
  const request = await models.request.getById(requestId);
  if (!request) {
    throw new Error(`Failed to find request: ${requestId}`);
  }

  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type
  ]);

  const workspaceDoc = ancestors.find(doc => doc.type === models.workspace.type);
  const workspaceId = workspaceDoc ? workspaceDoc._id : 'n/a';
  const workspace = await models.workspace.getById(workspaceId);
  if (!workspace) {
    throw new Error(`Failed to find workspace for: ${requestId}`);
  }

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';

  const newRequest: Request = await models.initModel(models.request.type, requestPatch, {
    _id: request._id + '.other',
    parentId: request._id
  });

  let renderResult: { request: RenderedRequest, context: Object };
  try {
    renderResult = await getRenderedRequestAndContext(newRequest, environmentId);
  } catch (err) {
    throw new Error(`Failed to render request: ${requestId}`);
  }

  return _actuallySend(renderResult.request, renderResult.context, workspace, settings);
}

export async function send(requestId: string, environmentId: string): Promise<ResponsePatch> {
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
    models.workspace.type
  ]);

  if (!request) {
    throw new Error(`Failed to find request to send for ${requestId}`);
  }

  const renderResult = await getRenderedRequestAndContext(
    request,
    environmentId,
    RENDER_PURPOSE_SEND
  );

  const renderedRequestBeforePlugins = renderResult.request;
  const renderedContextBeforePlugins = renderResult.context;

  const workspaceDoc = ancestors.find(doc => doc.type === models.workspace.type);
  const workspace = await models.workspace.getById(workspaceDoc ? workspaceDoc._id : 'n/a');
  if (!workspace) {
    throw new Error(`Failed to find workspace for request: ${requestId}`);
  }

  let renderedRequest: RenderedRequest;
  try {
    renderedRequest = await _applyRequestPluginHooks(
      renderedRequestBeforePlugins,
      renderedContextBeforePlugins
    );
  } catch (err) {
    return {
      url: renderedRequestBeforePlugins.url,
      parentId: renderedRequestBeforePlugins._id,
      error: err.message,
      statusCode: STATUS_CODE_PLUGIN_ERROR,
      statusMessage: err.plugin ? `Plugin ${err.plugin.name}` : 'Plugin',
      settingSendCookies: renderedRequestBeforePlugins.settingSendCookies,
      settingStoreCookies: renderedRequestBeforePlugins.settingStoreCookies
    };
  }

  return _actuallySend(renderedRequest, renderedContextBeforePlugins, workspace, settings);
}

async function _applyRequestPluginHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Object
): Promise<RenderedRequest> {
  const newRenderedRequest = clone(renderedRequest);
  for (const { plugin, hook } of await plugins.getRequestHooks()) {
    const context = {
      ...pluginContexts.app.init(),
      ...pluginContexts.store.init(plugin),
      ...pluginContexts.request.init(newRenderedRequest, renderedContext)
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
  request: RenderedRequest,
  renderContext: Object
): Promise<ResponsePatch> {
  const newResponse = clone(response);
  const newRequest = clone(request);

  for (const { plugin, hook } of await plugins.getResponseHooks()) {
    const context = {
      ...pluginContexts.app.init(),
      ...pluginContexts.store.init(plugin),
      ...pluginContexts.response.init(newResponse),
      ...pluginContexts.request.init(newRequest, renderContext, true)
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

export function _parseHeaders(
  buffer: Buffer
): Array<{
  headers: Array<ResponseHeader>,
  version: string,
  code: number,
  reason: string
}> {
  const results = [];

  const lines = buffer.toString('utf8').split(/\r?\n|\r/g);

  for (let i = 0, currentResult = null; i < lines.length; i++) {
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
        headers: []
      };
    } else {
      const [name, value] = line.split(/:\s(.+)/);
      const header: ResponseHeader = { name, value: value || '' };
      currentResult.headers.push(header);
    }
  }

  return results;
}

// exported for unit tests only
export function _getAwsAuthHeaders(
  credentials: {
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string
  },
  headers: Array<RequestHeader>,
  body: string,
  url: string,
  method: string,
  region?: string,
  service?: string
): Array<{ name: string, value: string, disabled?: boolean }> {
  const parsedUrl = urlParse(url);
  const contentTypeHeader = getContentTypeHeader(headers);

  // AWS uses host header for signing so prioritize that if the user set it manually
  const hostHeader = getHostHeader(headers);
  const host = hostHeader ? hostHeader.value : parsedUrl.host;

  const awsSignOptions = {
    service,
    region,
    body,
    method,
    host,
    path: parsedUrl.path,
    headers: contentTypeHeader ? { 'content-type': contentTypeHeader.value } : {}
  };

  const signature = aws4.sign(awsSignOptions, credentials);

  return Object.keys(signature.headers)
    .filter(name => name !== 'content-type') // Don't add this because we already have it
    .map(name => ({ name, value: signature.headers[name] }));
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  lastUserInteraction = Date.now();
});

document.addEventListener('paste', e => {
  lastUserInteraction = Date.now();
});
