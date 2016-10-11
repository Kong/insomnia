import networkRequest from 'request';
import {parse as urlParse} from 'url';
import * as db from './database';
import * as querystring from './querystring';
import * as util from './util.js';
import {DEBOUNCE_MILLIS, STATUS_CODE_PEBKAC} from './constants';
import {jarFromCookies, cookiesFromJar} from './cookies';
import {setDefaultProtocol} from './util';
import {getRenderedRequest} from './render';
import {swapHost} from './dns';
import {cookieHeaderValueForUri} from './cookies';

let cancelRequestFunction = null;

export function cancelCurrentRequest () {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
}

export function _buildRequestConfig (renderedRequest, patch = {}) {
  const config = {
    method: renderedRequest.method,
    body: renderedRequest.body,
    headers: {},

    // Setup redirect rules
    followAllRedirects: true,
    followRedirect: true,
    maxRedirects: 20,
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
  };

  // Set the URL, including the query parameters
  const qs = querystring.buildFromParams(renderedRequest.parameters);
  const url = querystring.joinURL(renderedRequest.url, qs);
  config.url = util.prepareUrlForSending(url);
  config.headers.host = urlParse(config.url).host;

  for (let i = 0; i < renderedRequest.headers.length; i++) {
    let header = renderedRequest.headers[i];
    if (header.name) {
      config.headers[header.name] = header.value;
    }
  }

  return Object.assign(config, patch);
}

export function _actuallySend (renderedRequest, settings) {
  return new Promise(async (resolve, reject) => {
    // Detect and set the proxy based on the request protocol
    // NOTE: request does not have a separate settings for http/https proxies
    const {protocol} = urlParse(renderedRequest.url);
    const {httpProxy, httpsProxy} = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;

    const config = _buildRequestConfig(renderedRequest, {
      jar: null, // We're doing our own cookies
      proxy: proxy,
      followAllRedirects: settings.followRedirects,
      followRedirect: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null,
      rejectUnauthorized: settings.validateSSL
    }, true);

    // Add the cookie header to the request
    const cookieJar = renderedRequest.cookieJar;
    const jar = jarFromCookies(cookieJar.cookies);
    const existingCookieHeaderName = Object.keys(config.headers).find(k => k.toLowerCase() === 'cookie');
    const cookieString = await cookieHeaderValueForUri(jar, config.url);

    if (cookieString && existingCookieHeaderName) {
      config.headers[existingCookieHeaderName] += `; ${cookieString}`;
    } else if (cookieString) {
      config.headers['Cookie'] = cookieString;
    }

    // Do DNS lookup ourselves
    // We don't want to let NodeJS do DNS, because it doesn't use
    // getaddrinfo by default. Instead, it first tries to reach out
    // to the network.
    const originalUrl = config.url;
    config.url = await swapHost(config.url);

    // TODO: Handle redirects ourselves
    const requestStartTime = Date.now();
    const req = networkRequest(config, async (err, networkResponse) => {
      if (err) {
        const isShittyParseError = err.toString() === 'Error: Parse Error';

        let message = err.toString();
        if (isShittyParseError) {
          message = `Error parsing response after ${err.bytesParsed} bytes.\n\n`;
          message += `Code: ${err.code}`;
        }

        await db.response.create({
          parentId: renderedRequest._id,
          error: message
        });

        return reject(err);
      }

      // TODO: Add image support to Insomnia
      const contentType = networkResponse.headers['content-type'];
      if (contentType && contentType.toLowerCase().indexOf('image/') === 0) {
        const err = new Error(`Content-Type ${contentType} not supported`);

        await db.response.create({
          parentId: renderedRequest._id,
          error: err.toString(),
          statusMessage: 'UNSUPPORTED'
        });

        return reject(err);
      }

      // Format the headers into Insomnia format
      // TODO: Move this to a better place
      const headers = [];
      for (const name of Object.keys(networkResponse.headers)) {
        const tmp = networkResponse.headers[name];
        const values = Array.isArray(tmp) ? tmp : [tmp];
        for (const value of values) {
          headers.push({name, value});
        }
      }

      // Update the cookie jar
      // NOTE: Since we're doing own DNS, we can't rely on Request to do this
      for (const h of util.getSetCookieHeaders(headers)) {
        try {
          jar.setCookieSync(h.value, originalUrl);
        } catch (e) {
          console.warn('Failed to parse set-cookie', h.value);
        }
      }
      const cookies = await cookiesFromJar(jar);
      await db.cookieJar.update(cookieJar, {cookies});

      const responsePatch = {
        parentId: renderedRequest._id,
        statusCode: networkResponse.statusCode,
        statusMessage: networkResponse.statusMessage,
        contentType: networkResponse.headers['content-type'],
        url: originalUrl, // TODO: Handle redirects somehow
        elapsedTime: networkResponse.elapsedTime,
        bytesRead: networkResponse.connection.bytesRead,
        body: networkResponse.body,
        headers: headers
      };

      db.response.create(responsePatch).then(resolve, reject);
    });

    // Kind of hacky, but this is how we cancel a request.
    cancelRequestFunction = async () => {
      req.abort();

      await db.response.create({
        parentId: renderedRequest._id,
        elapsedTime: Date.now() - requestStartTime,
        statusMessage: 'Cancelled',
        error: 'The request was cancelled'
      });

      return reject(new Error('Cancelled'));
    }
  })
}

export async function send (requestId) {
  // First, lets wait for all debounces to finish
  await util.delay(DEBOUNCE_MILLIS);

  const request = await db.request.getById(requestId);
  const settings = await db.settings.getOrCreate();

  let renderedRequest;

  try {
    renderedRequest = await getRenderedRequest(request);
  } catch (e) {
    // Failed to render. Must be the user's fault
    return await db.response.create({
      parentId: request._id,
      statusCode: STATUS_CODE_PEBKAC,
      error: e.message
    });
  }

  // Render succeeded so we're good to go!
  return await _actuallySend(renderedRequest, settings);
}
