import networkRequest from 'request';
import CombinedStream from 'combined-stream';
import FormData from 'form-data';
import {parse as urlParse} from 'url';
import mime from 'mime-types';
import {basename as pathBasename} from 'path';
import * as models from '../models';
import * as querystring from './querystring';
import {buildFromParams} from './querystring';
import * as util from './misc.js';
import {DEBOUNCE_MILLIS, STATUS_CODE_RENDER_FAILED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, getAppVersion} from './constants';
import {jarFromCookies, cookiesFromJar} from './cookies';
import {setDefaultProtocol, hasAcceptHeader, hasUserAgentHeader, getSetCookieHeaders} from './misc';
import {getRenderedRequest} from './render';
import * as fs from 'fs';
import * as db from './database';
import {remote} from 'electron';

// Defined fallback strategies for DNS lookup. By default, request uses Node's
// default dns.resolve which uses c-ares to do lookups. This doesn't work for
// some people, so we also fallback to IPv6 then IPv4 to force it to use
// getaddrinfo (OS lookup) instead of c-ares (external lookup).
const FAMILY_FALLBACKS = [
  null, // Use the request library default lookup
  6, // IPv6
  4, // IPv4
];

let cancelRequestFunction = null;

export function cancelCurrentRequest () {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
}

export function _buildRequestConfig (renderedRequest, patch = {}) {
  const config = {
    // Setup redirect rules
    followAllRedirects: true,
    followRedirect: true,
    maxRedirects: 50, // Arbitrary (large) number
    timeout: 0,

    // Unzip gzipped responses
    gzip: true,

    // Time the request
    time: true,

    // SSL Checking
    rejectUnauthorized: true,

    // Proxy
    proxy: null,

    // Use keep-alive by default
    forever: true,

    // Force request to return response body as a Buffer instead of string
    encoding: null,

    // Send authentication before unauthorized response
    sendImmediately: true,
  };

  // Set the body
  if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    config.body = buildFromParams(renderedRequest.body.params || [], true);
  } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
    const formData = {};
    for (const param of renderedRequest.body.params) {
      if (param.type === 'file' && param.fileName) {
        formData[param.name] = {
          value: fs.readFileSync(param.fileName),
          options: {
            filename: pathBasename(param.fileName),
            contentType: mime.lookup(param.fileName) // Guess the mime-type
          }
        }
      } else {
        formData[param.name] = param.value || '';
      }
    }
    config.formData = formData;
  } else if (renderedRequest.body.fileName) {
    config.body = fs.readFileSync(renderedRequest.body.fileName);
  } else {
    config.body = renderedRequest.body.text || '';
  }

  // Set the method
  config.method = renderedRequest.method;

  // Set the headers
  const headers = {};
  for (let i = 0; i < renderedRequest.headers.length; i++) {
    let header = renderedRequest.headers[i];
    if (header.name) {
      headers[header.name] = header.value;
    }
  }
  config.headers = headers;

  // Set the Accept header if it doesn't exist
  if (!hasAcceptHeader(renderedRequest.headers)) {
    config.headers['Accept'] = '*/*';
  }

  // Set UserAgent if it doesn't exist
  if (!hasUserAgentHeader(renderedRequest.headers)) {
    config.headers['User-Agent'] = `insomnia/${getAppVersion()}`
  }

  // Set the URL, including the query parameters
  const qs = querystring.buildFromParams(renderedRequest.parameters);
  const url = querystring.joinUrl(renderedRequest.url, qs);
  config.url = util.prepareUrlForSending(url);

  return Object.assign(config, patch);
}

function _getProxy (renderedRequest, settings) {
  // Detect and set the proxy based on the request protocol
  // NOTE: request does not have a separate settings for http/https proxies
  const {protocol} = urlParse(renderedRequest.url);
  const {httpProxy, httpsProxy} = settings;
  const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
  return proxyHost ? setDefaultProtocol(proxyHost) : null;
}

function _getSession (requestId) {
  // NOTE: Partition name without "Persist:" prefix will be in-memory
  const session = remote.session.fromPartition(requestId);
  session.setUserAgent(`insomnia/${getAppVersion()}`);

  // ~~~~~~~~~~~~ //
  // Clear caches //
  // ~~~~~~~~~~~~ //

  session.clearCache(() => {
    console.log('Cache cleared');
  });

  session.clearHostResolverCache(() => {
    console.log('Host cache cleared');
  });

  // session.clearAuthCache(); // Probably don't want to do this every time?

  // Disable network emulation if set
  session.disableNetworkEmulation();

  // Clear appcache, cookies, filesystem, indexdb, local storage,
  // shadercache, websql, serviceworkers
  session.clearStorageData({}, () => {
    console.log('Cleared storage data')
  });

  // TODO: Set the proxy
  session.setProxy({
    pacScript: null,
    proxyRules: null,
    proxyBypassRules: null,
  }, () => {
    // Done setting proxy
  });

  // Define method for verifying SSL certificates
  session.setCertificateVerifyProc((hostname, certificate, callback) => {
    // TODO: Always return true if SSL validation is off
    callback(true);
  });

  return session;
}

function _actuallySend2 (renderedRequest, workspace, settings) {
  // const proxy = _getProxy(renderedRequest, settings);
  const session = _getSession(renderedRequest._id);

  // THis doesn't work for some reason
  // session.webRequest.onBeforeSendHeaders((details, callback) => {
  //   console.log('REDIRECT', details);
  //   callback({
  //     cancel: false,
  //   });
  // });

  // ~~~~~~~~~~~~ //
  // Init request //
  // ~~~~~~~~~~~~ //

  const startTime = performance.now();
  const request = remote.net.request({
    url: renderedRequest.url,
    method: renderedRequest.method,
    session: session,
  });

  // Send body in chunks
  request.chunkedEncoding = true;

  // ~~~~~~~~~~~~~~~~~~~ //
  // Listen for response //
  // ~~~~~~~~~~~~~~~~~~~ //

  let data = '';
  request.on('response', response => {
    window.session = session;
    window.request = request;
    window.response = response;

    console.log('++++++++ RESPONSE', response.statusCode);

    response.on('end', () => {
      window.response = response;
      const duration = performance.now() - startTime;
      console.log('++++++++ END', duration, data.length, response);
    });

    response.on('data', chunk => {
      // console.log('++++++++ DATA', chunk.length);
      data += chunk;
    });
  });

  request.on('data', chunk => {
    console.log('REQUEST CHUNK', chunk);
  });

  request.on('end', () => {
    console.log('REQUEST DONE');
  });

  // ~~~~~~~~~~~~~ //
  // Handle events //
  // ~~~~~~~~~~~~~ //

  request.on('login', (authInfo, callback) => {
    // TODO: Handle login requests
    console.log('++++++++ LOGIN', authInfo);
    callback('myUsername', 'myPassword');
  });

  request.on('finish', () => {
    // Request body wrote last byte
    console.log('++++++++ FINISH');
  });

  request.on('abort', () => {
    // Request was aborted (not fired if already closed)
    console.log('++++++++ ABORT');
  });

  request.on('close', () => {
    // Request and response are completely done emitting events
    console.log('++++++++ CLOSE');
  });

  // ~~~~~~~~~~~~~~~ //
  // Set the headers //
  // ~~~~~~~~~~~~~~~ //

  for (const header of renderedRequest.headers) {
    request.setHeader(header.name, header.value);
  }

  // ~~~~~~~~~~~~~~ //
  // Write the body //
  // ~~~~~~~~~~~~~~ //

  if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    request.end(buildFromParams(renderedRequest.body.params || [], true));
  } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
    const form = new FormData();

    for (const param of renderedRequest.body.params) {
      if (param.type === 'file' && param.fileName) {
        form.append(param.name, fs.createReadStream(param.fileName));
      } else {
        form.append(param.name, param.value || '');
      }
    }

    const headers = form.getHeaders();
    for (const name of Object.keys(headers)) {
      request.setHeader(name, headers[name]);
    }

    // form-data's combined-stream doesn't work well with Electron.net so
    // this is a hack to drain the stream and send it to the request.
    // (form.pipe(request) should work, but it doesn't)
    // TODO: Do this a better way
    const dummyStream = CombinedStream.create();
    form.on('data', chunk => request.write(chunk));
    form.on('end', () => request.end());
    form.pipe(dummyStream);
  } else if (renderedRequest.body.fileName) {
    fs.createReadStream(renderedRequest.body.fileName).pipe(request);
  } else if (renderedRequest.body.text) {
    request.end(renderedRequest.body.text);
  } else {
    request.end();
  }
}

export function _actuallySend (renderedRequest, workspace, settings, familyIndex = 0) {
  if (familyIndex === 0) {
    return _actuallySend2(renderedRequest, workspace, settings);
  }

  return new Promise(async (resolve, reject) => {
    async function handleError (err, prefix = '') {
      await models.response.create({
        url: renderedRequest.url,
        parentId: renderedRequest._id,
        elapsedTime: 0,
        statusMessage: 'Error',
        error: prefix ? `${prefix}: ${err.message}` : err.message
      });

      reject(err);
    }

    // Detect and set the proxy based on the request protocol
    // NOTE: request does not have a separate settings for http/https proxies
    const {protocol} = urlParse(renderedRequest.url);
    const {httpProxy, httpsProxy} = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;

    let config;
    try {
      config = _buildRequestConfig(renderedRequest, {
        jar: null, // We're doing our own cookies
        proxy: proxy,
        followAllRedirects: settings.followRedirects,
        followRedirect: settings.followRedirects,
        timeout: settings.timeout > 0 ? settings.timeout : null,
        rejectUnauthorized: settings.validateSSL
      }, true);
    } catch (err) {
      return handleError(err, 'Failed to setup request');
    }

    try {
      // Add certs if needed
      // https://vanjakom.wordpress.com/2011/08/11/client-and-server-side-ssl-with-nodejs/
      const {hostname, port} = urlParse(config.url);
      const certificate = workspace.certificates.find(certificate => {
        const cHostWithProtocol = setDefaultProtocol(certificate.host, 'https:');
        const {hostname: cHostname, port: cPort} = urlParse(cHostWithProtocol);

        const assumedPort = parseInt(port) || 443;
        const assumedCPort = parseInt(cPort) || 443;

        // Exact host match (includes port)
        return cHostname === hostname && assumedCPort === assumedPort;
      });

      if (certificate && !certificate.disabled) {
        const {passphrase, cert, key, pfx} = certificate;
        config.cert = cert ? Buffer.from(cert, 'base64') : null;
        config.key = key ? Buffer.from(key, 'base64') : null;
        config.pfx = pfx ? Buffer.from(pfx, 'base64') : null;
        config.passphrase = passphrase || null;
      }
    } catch (err) {
      return handleError(err, 'Failed to set certificate');
    }

    try {
      // Add the cookie header to the request
      config.jar = networkRequest.jar();
      config.jar._jar = jarFromCookies(renderedRequest.cookieJar.cookies);
    } catch (err) {
      return handleError(err, 'Failed to set cookie jar');
    }

    // Set the IP family. This fallback behaviour is copied from Curl
    try {
      const family = FAMILY_FALLBACKS[familyIndex];
      if (family) {
        config.family = family;
      }
    } catch (err) {
      return handleError(err, 'Failed to set IP family');
    }

    config.callback = async (err, networkResponse) => {
      if (err) {
        const isShittyParseError = err.toString() === 'Error: Parse Error';

        // Failed to connect while prioritizing IPv6 address, fallback to IPv4
        const isNetworkRelatedError = (
          err.code === 'EAI_AGAIN' || // No entry
          err.code === 'ENOENT' || // No entry
          err.code === 'ENODATA' || // DNS resolve failed
          err.code === 'ENOTFOUND' || // Could not resolve DNS
          err.code === 'ECONNREFUSED' || // Could not talk to server
          err.code === 'EHOSTUNREACH' || // Could not reach host
          err.code === 'ENETUNREACH' // Could not access the network
        );

        const nextFamilyIndex = familyIndex + 1;
        if (isNetworkRelatedError && nextFamilyIndex < FAMILY_FALLBACKS.length) {
          const family = FAMILY_FALLBACKS[nextFamilyIndex];
          console.log(`-- Falling back to family ${family} --`);
          _actuallySend(
            renderedRequest, workspace, settings, nextFamilyIndex
          ).then(resolve, reject);
          return;
        }

        let message = err.toString();
        if (isShittyParseError) {
          message = `Error parsing response after ${err.bytesParsed} bytes.\n\n`;
          message += `Code: ${err.code}`;
        }

        await models.response.create({
          url: config.url,
          parentId: renderedRequest._id,
          statusMessage: 'Error',
          error: message
        });

        return reject(err);
      }

      // handle response headers
      const headers = [];
      try {
        for (const name of Object.keys(networkResponse.headers)) {
          const tmp = networkResponse.headers[name];
          const values = Array.isArray(tmp) ? tmp : [tmp];
          for (const value of values) {
            headers.push({name, value});
          }
        }
      } catch (err) {
        return handleError(err, 'Failed to parse response headers');
      }

      // NOTE: We only update jar if we get cookies
      if (getSetCookieHeaders(headers).length) {
        try {
          const cookies = await cookiesFromJar(config.jar._jar);
          await models.cookieJar.update(renderedRequest.cookieJar, {cookies});
        } catch (err) {
          return handleError(err, 'Failed to update cookie jar');
        }
      }

      let contentType = '';
      if (networkResponse.headers) {
        contentType = networkResponse.headers['content-type'] || ''
      }

      let bytesRead = 0;
      if (networkResponse.body) {
        bytesRead = networkResponse.body.length;
      }

      const bodyEncoding = 'base64';
      const responsePatch = {
        parentId: renderedRequest._id,
        statusCode: networkResponse.statusCode,
        statusMessage: networkResponse.statusMessage,
        url: config.url,
        contentType: contentType,
        elapsedTime: networkResponse.elapsedTime,
        bytesRead: bytesRead,
        body: networkResponse.body.toString(bodyEncoding),
        encoding: bodyEncoding,
        headers: headers
      };

      models.response.create(responsePatch).then(resolve, reject);
    };

    const requestStartTime = Date.now();
    const req = new networkRequest.Request(config);

    // Kind of hacky, but this is how we cancel a request.
    cancelRequestFunction = async () => {
      req.abort();

      await models.response.create({
        url: config.url,
        parentId: renderedRequest._id,
        elapsedTime: Date.now() - requestStartTime,
        statusMessage: 'Cancelled',
        error: 'The request was cancelled'
      });

      return reject(new Error('Cancelled'));
    }
  })
}

export async function send (requestId, environmentId) {
  // First, lets wait for all debounces to finish
  await util.delay(DEBOUNCE_MILLIS * 2);

  const request = await models.request.getById(requestId);
  const settings = await models.settings.getOrCreate();

  let renderedRequest;

  try {
    renderedRequest = await getRenderedRequest(request, environmentId);
  } catch (e) {
    // Failed to render. Must be the user's fault
    return await models.response.create({
      parentId: request._id,
      statusCode: STATUS_CODE_RENDER_FAILED,
      error: e.message
    });
  }

  // Get the workspace for the request
  const ancestors = await db.withAncestors(request);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);

  // Render succeeded so we're good to go!
  return await _actuallySend(renderedRequest, workspace, settings);
}
