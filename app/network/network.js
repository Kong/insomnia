import networkRequest from 'request';
import electron from 'electron';
import mkdirp from 'mkdirp';
import {parse as urlParse} from 'url';
import {Curl} from 'node-libcurl';
import mime from 'mime-types';
import {basename as pathBasename, join as pathJoin} from 'path';
import * as models from '../models';
import * as querystring from '../common/querystring';
import * as util from '../common/misc.js';
import {DEBOUNCE_MILLIS, STATUS_CODE_RENDER_FAILED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, getAppVersion} from '../common/constants';
import {jarFromCookies, cookiesFromJar} from '../common/cookies';
import {setDefaultProtocol, hasAcceptHeader, hasUserAgentHeader} from '../common/misc';
import {getRenderedRequest} from '../common/render';
import fs from 'fs';
import * as db from '../common/database';
import caCerts from './cacert';

// Defined fallback strategies for DNS lookup. By default, request uses Node's
// default dns.resolve which uses c-ares to do lookups. This doesn't work for
// some people, so we also fallback to IPv6 then IPv4 to force it to use
// getaddrinfo (OS lookup) instead of c-ares (external lookup).
const FAMILY_FALLBACKS = [
  null, // Use the request library default lookup
  6, // IPv6
  4 // IPv4
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
    encoding: null
  };

  // Set the body
  if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    config.body = querystring.buildFromParams(renderedRequest.body.params || [], true);
  } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
    const formData = {};
    for (const param of renderedRequest.body.params) {
      if (param.type === 'file' && param.fileName) {
        // Check if file exists first (read stream won't right away)
        fs.statSync(param.fileName);
        formData[param.name] = {
          value: fs.createReadStream(param.fileName),
          options: {
            filename: pathBasename(param.fileName),
            contentType: mime.lookup(param.fileName) // Guess the mime-type
          }
        };
      } else {
        formData[param.name] = param.value || '';
      }
    }
    config.formData = formData;
  } else if (renderedRequest.body.fileName) {
    // Check if file exists first (read stream won't right away)
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
    config.headers['User-Agent'] = `insomnia/${getAppVersion()}`;
  }

  // Set the URL, including the query parameters
  const qs = querystring.buildFromParams(renderedRequest.parameters);
  const url = querystring.joinUrl(renderedRequest.url, qs);
  config.url = util.prepareUrlForSending(url);

  return Object.assign(config, patch);
}

export function _actuallySendCurl (renderedRequest, workspace, settings) {
  return new Promise(async resolve => {
    function handleError (err, prefix = null) {
      resolve({
        url: renderedRequest.url,
        parentId: renderedRequest._id,
        error: prefix ? `${prefix}: ${err.message}` : err.message,
        elapsedTime: 0,
        statusMessage: 'Error'
      });
    }

    try {
      // Setup the cancellation logic
      let cancelCode = 0;
      cancelRequestFunction = () => {
        cancelCode = 1;
      };

      // Initialize the curl handle
      const curl = new Curl();

      // Set all the basic options
      curl.setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);
      curl.setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects); // Follow redirects
      curl.setOpt(Curl.option.POSTREDIR, settings.followRedirects ? 2 ^ 3 : 0); // Follow POST redirects
      curl.setOpt(Curl.option.SSL_VERIFYPEER, settings.validateSSL); // Validate SSL
      curl.setOpt(Curl.option.TIMEOUT_MS, settings.timeout);
      curl.setOpt(Curl.option.VERBOSE, true);
      curl.setOpt(Curl.option.NOPROGRESS, false);

      let lastPercent = 0;
      curl.setOpt(Curl.option.XFERINFOFUNCTION, (dltotal, dlnow, ultotal, ulnow) => {
        if (dltotal === 0) {
          return cancelCode;
        }

        const percent = Math.round(dlnow / dltotal * 100);
        if (percent !== lastPercent) {
          console.log('PROGRESS 2', `${percent}%`, ultotal, ulnow);
          lastPercent = percent;
        }

        return cancelCode;
      });

      // Set the URL, including the query parameters
      const qs = querystring.buildFromParams(renderedRequest.parameters);
      const url = querystring.joinUrl(renderedRequest.url, qs);
      curl.setOpt(Curl.option.URL, util.prepareUrlForSending(url));

      // Setup CA Root Certificates if not on Mac. Thanks to libcurl, Mac will use
      // certificates form the OS.
      if (process.platform !== 'darwin') {
        const fullBase = pathJoin(electron.remote.app.getPath('temp'), 'insomnia');
        mkdirp.sync(fullBase);

        const name = `ca.pem`;
        const fullPath = pathJoin(fullBase, name);
        fs.writeFileSync(fullPath, caCerts);

        console.log('[net] Set CA to', fullPath);
        curl.setOpt(Curl.option.CAINFO, fullPath);
      }

      // Set cookies
      curl.setOpt(Curl.option.COOKIEFILE, ''); // Enable cookies
      for (const cookie of renderedRequest.cookieJar.cookies) {
        let expiresTimestamp = 0;
        if (cookie.expires) {
          const expiresDate = new Date(cookie.expires);
          console.log('HELLO', expiresDate);
          expiresTimestamp = Math.round(expiresDate.getTime() / 1000);
        }
        curl.setOpt(Curl.option.COOKIELIST, [
          cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
          cookie.hostOnly ? 'TRUE' : 'FALSE',
          cookie.path,
          cookie.secure ? 'TRUE' : 'FALSE',
          expiresTimestamp,
          cookie.key,
          cookie.value
        ].join('\t'));
      }

      // Set proxy
      const {protocol} = urlParse(renderedRequest.url);
      const {httpProxy, httpsProxy} = settings;
      const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
      const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
      if (proxy) {
        curl.setOpt(Curl.option.PROXY, proxy);
      } else {
        // Disable autodetection from env vars
        curl.setOpt(Curl.option.PROXY, '');
      }

      // Set client certs if needed
      for (const certificate of workspace.certificates) {
        const cHostWithProtocol = setDefaultProtocol(certificate.host, 'https:');
        const {hostname: cHostname, port: cPort} = urlParse(cHostWithProtocol);
        const {hostname, port} = urlParse(renderedRequest.url);

        const assumedPort = parseInt(port) || 443;
        const assumedCPort = parseInt(cPort) || 443;

        // Exact host match (includes port)
        if (cHostname === hostname && assumedCPort === assumedPort) {
          const ensureFile = blobOrFilename => {
            if (blobOrFilename.indexOf('/') === 0) {
              return blobOrFilename;
            } else {
              // Legacy support. Certs used to be stored in blobs, so lets write it to
              // the temp directory first.
              // TODO: Delete this fallback eventually
              const fullBase = pathJoin(electron.remote.app.getPath('temp'), 'insomnia');
              mkdirp.sync(fullBase);

              const name = `${renderedRequest._id}_${renderedRequest.modified}`;
              const fullPath = pathJoin(fullBase, name);
              fs.writeFileSync(fullPath, new Buffer(blobOrFilename, 'base64'));

              return fullPath;
            }
          };

          const {passphrase, cert, key, pfx} = certificate;

          if (cert) {
            curl.setOpt(Curl.option.SSLCERT, ensureFile(cert));
            curl.setOpt(Curl.option.SSLCERTTYPE, 'PEM');
          }

          if (pfx) {
            curl.setOpt(Curl.option.SSLCERT, ensureFile(pfx));
            curl.setOpt(Curl.option.SSLCERTTYPE, 'P12');
          }

          if (key) {
            curl.setOpt(Curl.option.SSLKEY, ensureFile(key));
          }

          if (passphrase) {
            curl.setOpt(Curl.option.KEYPASSWD, passphrase);
          }
        }
      }

      // Build the body
      if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
        const d = querystring.buildFromParams(renderedRequest.body.params || [], true);
        curl.setOpt(Curl.option.POSTFIELDS, d); // Send raw data
      } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
        const data = renderedRequest.body.params.map(param => {
          if (param.type === 'file' && param.fileName) {
            return {name: param.name, file: param.fileName};
          } else {
            return {name: param.name, contents: param.value};
          }
        });
        curl.setOpt(Curl.option.HTTPPOST, data);
      } else if (renderedRequest.body.fileName) {
        const fd = fs.openSync(renderedRequest.body.fileName, 'r+');
        curl.setOpt(Curl.option.UPLOAD, 1);
        curl.setOpt(Curl.option.READDATA, fd);
        const fn = () => fs.closeSync(fd);
        curl.on('end', fn);
        curl.on('error', fn);
      } else if (typeof renderedRequest.body.text === 'string') {
        curl.setOpt(Curl.option.POSTFIELDS, renderedRequest.body.text);
      } else {
        // No body
      }

      // Build the body
      const dataBuffers = [];
      let dataBuffersLength = 0;
      curl.on('data', chunk => {
        dataBuffers.push(chunk);
        dataBuffersLength += chunk.length;
      });

      // Set the headers
      const headers = renderedRequest.headers.map(h => `${h.name}: ${h.value}`);
      curl.setOpt(Curl.option.HTTPHEADER, headers);

      // Setup debug handler
      // NOTE: This is last on purpose so things like cookies don't show up
      let debugData = '';
      curl.setOpt(Curl.option.DEBUGFUNCTION, (infoType, content) => {
        const name = Object.keys(Curl.info.debug).find(k => Curl.info.debug[k] === infoType);
        let symbol = null;
        switch (name) {
          case 'HEADER_IN':
            symbol = '<';
            break;
          case 'HEADER_OUT':
            symbol = '>';
            break;
          case 'TEXT':
            symbol = '*';
            break;
          // Don't show these (too much data)
          // case 'DATA_IN':
          // case 'DATA_OUT':
        }

        if (symbol) {
          const lines = content.replace(/\n$/, '').split('\n');
          const newLines = lines.map(l => `${symbol} ${l}`);
          const blob = newLines.join('\n');
          debugData += blob + '\n';
        }

        return 0; // Must be here
      });

      // Handle the response ending
      curl.on('end', function (_1, _2, curlHeaders) {
        // Headers are an array (one for each redirect)
        curlHeaders = curlHeaders[curlHeaders.length - 1];

        // Collect various things
        const statusCode = curlHeaders.result.code || 0;
        const statusMessage = curlHeaders.result.reason || 'Unknown';
        const elapsedTime = this.getInfo('TOTAL_TIME') * 1000;
        const bytesRead = this.getInfo('SIZE_DOWNLOAD');
        const url = this.getInfo('EFFECTIVE_URL');

        // Collect the headers
        const headers = [];
        for (const name of Object.keys(curlHeaders)) {
          if (typeof curlHeaders[name] === 'string') {
            headers.push({name, value: curlHeaders[name]});
          } else if (Array.isArray(curlHeaders[name])) {
            for (const value of curlHeaders[name]) {
              headers.push({name, value});
            }
          }
        }

        // Handle debug data
        if (debugData) {
          // TODO: Do something with debug data
          // fs.writeFileSync('/Users/gschier/Desktop/debug.txt', debugData, 'utf8');
        }

        // Calculate the content type
        const contentTypeHeader = util.getContentTypeHeader(headers);
        const contentType = contentTypeHeader ? contentTypeHeader.value : '';

        // Update Cookie Jar
        const cookies = [];
        for (const str of curl.getInfo(Curl.info.COOKIELIST)) {
          //  0                    1                  2     3       4       5     6
          // [#HttpOnly_.hostname, includeSubdomains, path, secure, expiry, name, value]
          const parts = str.split('\t');

          const hostname = parts[0].replace(/^#HttpOnly_/, '');
          const httpOnly = hostname.length !== parts[0].length;

          cookies.push({
            domain: hostname,
            httpOnly: httpOnly,
            hostOnly: parts[1] === 'TRUE',
            path: parts[2],
            secure: parts[3] === 'TRUE', // This doesn't exists?
            expires: new Date(parts[4] * 1000),
            key: parts[5],
            value: parts[6]
          });
        }
        models.cookieJar.update(renderedRequest.cookieJar, {cookies});

        // Handle the body
        const encoding = 'base64';
        const bodyBuffer = Buffer.concat(dataBuffers, dataBuffersLength);
        const body = bodyBuffer.toString(encoding);

        // Return the response data
        resolve({
          parentId: renderedRequest._id,
          headers,
          encoding,
          body,
          url,
          bytesRead,
          elapsedTime,
          contentType,
          statusCode,
          statusMessage
        });

        // Close the request
        this.close();
      });

      curl.on('error', function (err, code) {
        const elapsedTime = this.getInfo('TOTAL_TIME') * 1000;
        const parentId = renderedRequest._id;

        let error = err + '';
        let statusMessage = 'Error';

        if (code === Curl.code.CURLE_ABORTED_BY_CALLBACK) {
          error = 'Request aborted';
          statusMessage = 'Abort';
        }

        resolve({parentId, elapsedTime, statusMessage, error});
      });

      curl.perform();
    } catch (err) {
      handleError(err);
    }
  });
}

export function _actuallySend (renderedRequest, workspace, settings, familyIndex = 0) {
  return new Promise(async resolve => {
    async function handleError (err, prefix = '') {
      resolve({
        url: renderedRequest.url,
        parentId: renderedRequest._id,
        elapsedTime: 0,
        statusMessage: 'Error',
        error: prefix ? `${prefix}: ${err.message}` : err.message
      });
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

          return _actuallySend(
            renderedRequest, workspace, settings, nextFamilyIndex
          ).then(resolve);
        }

        let message = err.toString();
        if (isShittyParseError) {
          message = `Error parsing response after ${err.bytesParsed} bytes.\n\n`;
          message += `Code: ${err.code}`;
        }

        return resolve({
          url: config.url,
          parentId: renderedRequest._id,
          statusMessage: 'Error',
          error: message
        });
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

      try {
        const cookies = await cookiesFromJar(config.jar._jar);
        await models.cookieJar.update(renderedRequest.cookieJar, {cookies});
      } catch (err) {
        return handleError(err, 'Failed to update cookie jar');
      }

      let contentType = '';
      if (networkResponse.headers) {
        contentType = networkResponse.headers['content-type'] || '';
      }

      let bytesRead = 0;
      if (networkResponse.body) {
        bytesRead = networkResponse.body.length;
      }

      const bodyEncoding = 'base64';
      return resolve({
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
      });
    };

    const requestStartTime = Date.now();
    const req = new networkRequest.Request(config);

    // Kind of hacky, but this is how we cancel a request.
    cancelRequestFunction = async () => {
      req.abort();

      resolve({
        url: config.url,
        parentId: renderedRequest._id,
        elapsedTime: Date.now() - requestStartTime,
        statusMessage: 'Cancelled',
        error: 'The request was cancelled'
      });
    };
  });
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
    return {
      parentId: request._id,
      statusCode: STATUS_CODE_RENDER_FAILED,
      error: e.message
    };
  }

  // Get the workspace for the request
  const ancestors = await db.withAncestors(request);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);

  // Render succeeded so we're good to go!
  return _actuallySendCurl(renderedRequest, workspace, settings);
  // return _actuallySend(renderedRequest, workspace, settings);
}
