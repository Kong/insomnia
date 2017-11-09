// @flow
import type {ResponseHeader, ResponseTimelineEntry} from '../models/response';
import type {RequestHeader} from '../models/request';
import type {Workspace} from '../models/workspace';
import type {Settings} from '../models/settings';
import type {RenderedRequest} from '../common/render';
import {getRenderContext, getRenderedRequest} from '../common/render';
import mkdirp from 'mkdirp';
import clone from 'clone';
import {parse as urlParse, resolve as urlResolve} from 'url';
import {Curl} from 'insomnia-node-libcurl';
import {join as pathJoin} from 'path';
import * as models from '../models';
import * as querystring from '../common/querystring';
import * as util from '../common/misc.js';
import {AUTH_AWS_IAM, AUTH_BASIC, AUTH_DIGEST, AUTH_NETRC, AUTH_NTLM, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, getAppVersion, getTempDir, STATUS_CODE_PLUGIN_ERROR} from '../common/constants';
import {describeByteSize, getContentTypeHeader, hasAuthHeader, hasContentTypeHeader, hasUserAgentHeader, setDefaultProtocol} from '../common/misc';
import fs from 'fs';
import * as db from '../common/database';
import * as CACerts from './cacert';
import * as plugins from '../plugins/index';
import * as pluginContexts from '../plugins/context/index';
import {getAuthHeader} from './authentication';
import {cookiesFromJar, jarFromCookies} from '../common/cookies';
import {urlMatchesCertHost} from './url-matches-cert-host';
import aws4 from 'aws4';
import {buildMultipart} from './multipart';

export type ResponsePatch = {
  statusMessage?: string,
  error?: string,
  url?: string,
  statusCode?: number,
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

let cancelRequestFunction = null;
let lastUserInteraction = Date.now();

export function cancelCurrentRequest () {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
}

export function _actuallySend (
  renderedRequest: RenderedRequest,
  workspace: Workspace,
  settings: Settings
): Promise<{bodyBuffer: ?Buffer, response: ResponsePatch}> {
  return new Promise(async resolve => {
    let timeline: Array<ResponseTimelineEntry> = [];

    // Initialize the curl handle
    const curl = new Curl();

    /** Helper function to respond with a success */
    function respond (patch: ResponsePatch, bodyBuffer: ?Buffer = null): void {
      const response = Object.assign(({
        parentId: renderedRequest._id,
        timeline: timeline,
        settingSendCookies: renderedRequest.settingSendCookies,
        settingStoreCookies: renderedRequest.settingStoreCookies
      }: ResponsePatch), patch);

      resolve({bodyBuffer, response});

      // Apply plugin hooks and don't wait for them and don't throw from them
      process.nextTick(async () => {
        try {
          await _applyResponsePluginHooks(response, bodyBuffer);
        } catch (err) {
          // TODO: Better error handling here
          console.warn('Response plugin failed', err);
        }
      });
    }

    /** Helper function to respond with an error */
    function handleError (err: Error): void {
      respond({
        url: renderedRequest.url,
        parentId: renderedRequest._id,
        error: err.message,
        elapsedTime: 0,
        statusMessage: 'Error',
        settingSendCookies: renderedRequest.settingSendCookies,
        settingStoreCookies: renderedRequest.settingStoreCookies
      });
    }

    /** Helper function to set Curl options */
    function setOpt (opt: number, val: any, optional: boolean = false) {
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

    try {
      // Setup the cancellation logic
      cancelRequestFunction = () => {
        respond({
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          url: curl.getInfo(Curl.info.EFFECTIVE_URL),
          statusMessage: 'Cancelled',
          error: 'Request was cancelled'
        });

        // Kill it!
        curl.close();
      };

      // Set all the basic options
      setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects);
      setOpt(Curl.option.TIMEOUT_MS, settings.timeout); // 0 for no timeout
      setOpt(Curl.option.VERBOSE, true); // True so debug function works
      setOpt(Curl.option.NOPROGRESS, false); // False so progress function works

      // Set maximum amount of redirects allowed
      // NOTE: Setting this to -1 breaks some versions of libcurl
      if (settings.maxRedirects > 0) {
        setOpt(Curl.option.MAXREDIRS, settings.maxRedirects);
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

        if (
          infoType === Curl.info.debug.SSL_DATA_IN ||
          infoType === Curl.info.debug.SSL_DATA_OUT
        ) {
          return 0;
        }

        // Ignore the possibly large data messages
        if (infoType === Curl.info.debug.DATA_OUT) {
          if (content.length === 0) {
            // Sometimes this happens, but I'm not sure why. Just ignore it.
          } else if (content.length < 1000) {
            timeline.push({name, value: content});
          } else {
            timeline.push({name, value: `(${describeByteSize(content.length)} hidden)`});
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

        timeline.push({name, value: content});

        return 0; // Must be here
      });

      // Set the headers (to be modified as we go)
      const headers = clone(renderedRequest.headers);

      let lastPercent = 0;
      // NOTE: This option was added in 7.32.0 so make it optional
      setOpt(Curl.option.XFERINFOFUNCTION, (dltotal, dlnow, ultotal, ulnow) => {
        if (dltotal === 0) {
          return 0;
        }

        const percent = Math.round(dlnow / dltotal * 100);
        if (percent !== lastPercent) {
          // console.log('PROGRESS 2', `${percent}%`, ultotal, ulnow);
          lastPercent = percent;
        }

        return 0;
      }, true);

      // Set the URL, including the query parameters
      const qs = querystring.buildFromParams(renderedRequest.parameters);
      const url = querystring.joinUrl(renderedRequest.url, qs);
      const isUnixSocket = url.match(/https?:\/\/unix:\//);
      const finalUrl = util.prepareUrlForSending(url, renderedRequest.settingEncodeUrl);
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
      timeline.push({name: 'TEXT', value: 'Preparing request to ' + finalUrl});
      timeline.push({name: 'TEXT', value: `Using ${Curl.getVersion()}`});

      // log some things
      if (renderedRequest.settingEncodeUrl) {
        timeline.push({name: 'TEXT', value: 'Enable automatic URL encoding'});
      } else {
        timeline.push({name: 'TEXT', value: 'Disable automatic URL encoding'});
      }

      // SSL Validation
      if (settings.validateSSL) {
        timeline.push({name: 'TEXT', value: 'Enable SSL validation'});
      } else {
        setOpt(Curl.option.SSL_VERIFYHOST, 0);
        setOpt(Curl.option.SSL_VERIFYPEER, 0);
        timeline.push({name: 'TEXT', value: 'Disable SSL validation'});
      }

      // Setup CA Root Certificates if not on Mac. Thanks to libcurl, Mac will use
      // certificates form the OS.
      if (process.platform !== 'darwin') {
        const basCAPath = getTempDir();
        const fullCAPath = pathJoin(basCAPath, CACerts.filename);

        try {
          fs.statSync(fullCAPath);
        } catch (err) {
          // Doesn't exist yet, so write it
          mkdirp.sync(basCAPath);
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

          setOpt(Curl.option.COOKIELIST, [
            cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
            cookie.hostOnly ? 'FALSE' : 'TRUE',
            cookie.path,
            cookie.secure ? 'TRUE' : 'FALSE',
            expiresTimestamp,
            cookie.key,
            cookie.value
          ].join('\t'));
        }

        for (const {name, value} of renderedRequest.cookies) {
          setOpt(Curl.option.COOKIE, `${name}=${value}`);
        }

        timeline.push({
          name: 'TEXT',
          value: 'Enable cookie sending with jar of ' +
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
        const {protocol} = urlParse(renderedRequest.url);
        const {httpProxy, httpsProxy, noProxy} = settings;
        const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
        const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
        timeline.push({name: 'TEXT', value: `Enable network proxy for ${protocol || ''}`});
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
              // Certificate file now found!
              // LEGACY: Certs used to be stored in blobs (not as paths), so lets write it to
              // the temp directory first.
              const fullBase = getTempDir();
              mkdirp.sync(fullBase);

              const name = `${renderedRequest._id}_${renderedRequest.modified}`;
              const fullPath = pathJoin(fullBase, name);
              fs.writeFileSync(fullPath, new Buffer(blobOrFilename, 'base64'));

              // Set filename to the one we just saved
              blobOrFilename = fullPath;
            }

            return blobOrFilename;
          };

          const {passphrase, cert, key, pfx} = certificate;

          if (cert) {
            setOpt(Curl.option.SSLCERT, ensureFile(cert));
            setOpt(Curl.option.SSLCERTTYPE, 'PEM');
            timeline.push({name: 'TEXT', value: 'Adding SSL PEM certificate'});
          }

          if (pfx) {
            setOpt(Curl.option.SSLCERT, ensureFile(pfx));
            setOpt(Curl.option.SSLCERTTYPE, 'P12');
            timeline.push({name: 'TEXT', value: 'Adding SSL P12 certificate'});
          }

          if (key) {
            setOpt(Curl.option.SSLKEY, ensureFile(key));
            timeline.push({name: 'TEXT', value: 'Adding SSL KEY certificate'});
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
        requestBody = querystring.buildFromParams(renderedRequest.body.params || [], false);
      } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
        const params = renderedRequest.body.params || [];
        const {filePath: multipartBodyPath, boundary, contentLength} = await buildMultipart(params);

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

        const fd = fs.openSync(multipartBodyPath, 'r+');

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
        const {size} = fs.statSync(renderedRequest.body.fileName);
        const fileName = renderedRequest.body.fileName || '';
        const fd = fs.openSync(fileName, 'r+');

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
        headers.push({name: 'Expect', value: ''});
        headers.push({name: 'Transfer-Encoding', value: ''});
      }

      // If we calculated the body within Insomnia (ie. not computed by Curl)
      if (requestBody !== null) {
        setOpt(Curl.option.POSTFIELDS, requestBody);
      }

      // Setup encoding settings
      headers.push({name: 'Accept', value: '*/*'}); // Default to anything
      headers.push({name: 'Accept-Encoding', value: ''}); // Don't auto-send this header
      setOpt(Curl.option.ACCEPT_ENCODING, ''); // Auto decode everything

      // Build the body
      const dataBuffers = [];
      let dataBuffersLength = 0;
      curl.on('data', chunk => {
        dataBuffers.push(chunk);
        dataBuffersLength += chunk.length;
      });

      // Handle Authorization header
      if (!hasAuthHeader(headers) && !renderedRequest.authentication.disabled) {
        if (renderedRequest.authentication.type === AUTH_BASIC) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.BASIC);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_DIGEST) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.DIGEST);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_NTLM) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.NTLM);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_AWS_IAM) {
          if (!noBody && !requestBody) {
            return handleError(
              new Error('AWS authentication not supported for provided body type'));
          }
          const extraHeaders = _getAwsAuthHeaders(
            renderedRequest.authentication.accessKeyId || '',
            renderedRequest.authentication.secretAccessKey || '',
            headers,
            requestBody || '',
            finalUrl,
            renderedRequest.method
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

      // Set User-Agent if it't not already in headers
      if (!hasUserAgentHeader(headers)) {
        setOpt(Curl.option.USERAGENT, `insomnia/${getAppVersion()}`);
      }

      // Prevent curl from adding default content-type header
      if (!hasContentTypeHeader(headers)) {
        headers.push({name: 'content-type', value: ''});
      }

      // NOTE: This is last because headers might be modified multiple times
      const headerStrings = headers
        .filter(h => h.name)
        .map(h => `${(h.name || '').trim()}: ${h.value}`);
      setOpt(Curl.option.HTTPHEADER, headerStrings);

      // Handle the response ending
      curl.on('end', async function (_1, _2, allCurlHeadersObjects) {
        // Headers are an array (one for each redirect)
        const lastCurlHeadersObject = allCurlHeadersObjects[allCurlHeadersObjects.length - 1];

        // Collect various things
        const result = lastCurlHeadersObject && lastCurlHeadersObject.result;
        const statusCode = result ? result.code : -1;
        const statusMessage = result ? result.reason : 'Unknown';

        // Collect the headers
        const headers = [];
        for (const name of lastCurlHeadersObject ? Object.keys(lastCurlHeadersObject) : []) {
          if (typeof lastCurlHeadersObject[name] === 'string') {
            headers.push({name, value: lastCurlHeadersObject[name]});
          } else if (Array.isArray(lastCurlHeadersObject[name])) {
            for (const value of lastCurlHeadersObject[name]) {
              headers.push({name, value});
            }
          }
        }

        // Calculate the content type
        const contentTypeHeader = util.getContentTypeHeader(headers);
        const contentType = contentTypeHeader ? contentTypeHeader.value : '';

        // Update Cookie Jar
        let currentUrl = finalUrl;
        let setCookieStrings = [];
        const jar = jarFromCookies(renderedRequest.cookieJar.cookies);

        for (const curlHeaderObject of allCurlHeadersObjects) {
          // Collect Set-Cookie headers
          const setCookieHeaders = _getCurlHeader(curlHeaderObject, 'set-cookie', []);
          setCookieStrings = [...setCookieStrings, ...setCookieHeaders];

          // Pull out new URL if there is a redirect
          const newLocation = _getCurlHeader(curlHeaderObject, 'location', null);
          if (newLocation !== null) {
            currentUrl = urlResolve(currentUrl, newLocation);
          }
        }

        // Update jar with Set-Cookie headers
        for (const setCookieStr of setCookieStrings) {
          try {
            jar.setCookieSync(setCookieStr, currentUrl);
          } catch (err) {
            timeline.push({name: 'TEXT', value: `Rejected cookie: ${err.message}`});
          }
        }

        // Update cookie jar if we need to and if we found any cookies
        if (renderedRequest.settingStoreCookies && setCookieStrings.length) {
          const cookies = await cookiesFromJar(jar);
          models.cookieJar.update(renderedRequest.cookieJar, {cookies});
        }

        // Print informational message
        if (setCookieStrings.length > 0) {
          const n = setCookieStrings.length;
          if (renderedRequest.settingStoreCookies) {
            timeline.push({name: 'TEXT', value: `Saved ${n} cookie${n === 1 ? '' : 's'}`});
          } else {
            timeline.push({name: 'TEXT', value: `Ignored ${n} cookie${n === 1 ? '' : 's'}`});
          }
        }

        // Handle the body
        const bodyBuffer = Buffer.concat(dataBuffers, dataBuffersLength);

        // Return the response data
        const responsePatch = {
          headers,
          contentType,
          statusCode,
          statusMessage,
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          bytesContent: bodyBuffer.length,
          url: curl.getInfo(Curl.info.EFFECTIVE_URL)
        };

        // Close the request
        this.close();

        respond(responsePatch, bodyBuffer);
      });

      curl.on('error', function (err, code) {
        let error = err + '';
        let statusMessage = 'Error';

        if (code === Curl.code.CURLE_ABORTED_BY_CALLBACK) {
          error = 'Request aborted';
          statusMessage = 'Abort';
        }

        respond({statusMessage, error});
      });

      curl.perform();
    } catch (err) {
      handleError(err);
    }
  });
}

export async function send (requestId: string, environmentId: string) {
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
    await util.delay(delayMillis);
  }

  // Fetch some things
  const request = await models.request.getById(requestId);
  const settings = await models.settings.getOrCreate();
  const ancestors = await db.withAncestors(request, [
    models.requestGroup.type,
    models.workspace.type
  ]);

  if (!request) {
    throw new Error(`Failed to find request to send for ${requestId}`);
  }

  const renderedRequestBeforePlugins = await getRenderedRequest(request, environmentId);
  const renderedContextBeforePlugins = await getRenderContext(request, environmentId, ancestors);

  let renderedRequest: RenderedRequest;
  try {
    renderedRequest = await _applyRequestPluginHooks(renderedRequestBeforePlugins, renderedContextBeforePlugins);
  } catch (err) {
    return {
      response: {
        url: renderedRequestBeforePlugins.url,
        parentId: renderedRequestBeforePlugins._id,
        error: err.message,
        statusCode: STATUS_CODE_PLUGIN_ERROR,
        statusMessage: err.plugin ? `Plugin ${err.plugin}` : 'Plugin',
        settingSendCookies: renderedRequestBeforePlugins.settingSendCookies,
        settingStoreCookies: renderedRequestBeforePlugins.settingStoreCookies
      }
    };
  }

  const workspaceDoc = ancestors.find(doc => doc.type === models.workspace.type);
  const workspace = await models.workspace.getById(workspaceDoc ? workspaceDoc._id : 'n/a');
  if (!workspace) {
    throw new Error(`Failed to find workspace for request: ${requestId}`);
  }

  return _actuallySend(renderedRequest, workspace, settings);
}

async function _applyRequestPluginHooks (
  renderedRequest: RenderedRequest,
  renderedContext: Object
): Promise<RenderedRequest> {
  let newRenderedRequest = renderedRequest;
  for (const {plugin, hook} of await plugins.getRequestHooks()) {
    newRenderedRequest = clone(newRenderedRequest);

    const context = {
      ...pluginContexts.app.init(plugin),
      ...pluginContexts.request.init(plugin, newRenderedRequest, renderedContext)
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

async function _applyResponsePluginHooks (
  response: ResponsePatch,
  bodyBuffer: ?Buffer = null
): Promise<void> {
  for (const {plugin, hook} of await plugins.getResponseHooks()) {
    const context = {
      ...pluginContexts.app.init(plugin),
      ...pluginContexts.response.init(plugin, response, bodyBuffer)
    };

    try {
      await hook(context);
    } catch (err) {
      err.plugin = plugin;
      throw err;
    }
  }
}

function _getCurlHeader (
  curlHeadersObj: {[string]: string},
  name: string,
  fallback: any
): string {
  const headerName = Object.keys(curlHeadersObj).find(
    n => n.toLowerCase() === name.toLowerCase()
  );

  if (headerName) {
    return curlHeadersObj[headerName];
  } else {
    return fallback;
  }
}

// exported for unit tests only
export function _getAwsAuthHeaders (
  accessKeyId: string,
  secretAccessKey: string,
  headers: Array<RequestHeader>,
  body: string,
  url: string,
  method: string
) {
  const credentials = {accessKeyId, secretAccessKey};

  const parsedUrl = urlParse(url);
  const contentTypeHeader = util.getContentTypeHeader(headers);

  const awsSignOptions = {
    body,
    method,
    path: parsedUrl.path,
    host: parsedUrl.hostname, // Purposefully not ".host" because we don't want the port
    headers: {
      'content-type': contentTypeHeader ? contentTypeHeader.value : ''
    }
  };

  const signature = aws4.sign(awsSignOptions, credentials);

  return Object.keys(signature.headers)
    .filter(name => name !== 'content-type') // Don't add this because we already have it
    .map(name => ({name, value: signature.headers[name]}));
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
