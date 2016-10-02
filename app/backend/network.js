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
    maxRedirects: 20,
    timeout: 0,

    // Unzip gzipped responses
    gzip: true,

    // Time the request
    time: true,

    // SSL Checking
    rejectUnauthorized: true,

    // Proxy
    proxy: null
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
    const cookieJar = renderedRequest.cookieJar;
    const jar = jarFromCookies(cookieJar.cookies);

    // Detect and set the proxy based on the request protocol
    // NOTE: request does not have a separate settings for http/https proxies
    const {protocol} = urlParse(renderedRequest.url);
    const {httpProxy, httpsProxy} = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;

    const config = _buildRequestConfig(renderedRequest, {
      jar: jar,
      proxy: proxy,
      followAllRedirects: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null,
      rejectUnauthorized: settings.validateSSL
    }, true);

    // Do DNS lookup ourselves
    // We don't want to let NodeJS do DNS, because it doesn't use
    // getaddrinfo by default. Instead, it first tries to reach out
    // to the network.
    config.url = await swapHost(config.url);

    // TODO: Handle redirects ourselves
    const req = networkRequest(config, async (err, networkResponse) => {
      if (err) {
        const isShittyParseError = err.toString() === 'Error: Parse Error';

        let message = err.toString();
        if (isShittyParseError) {
          message = 'Could not parse malformed response.'
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

      // Update the cookie jar
      const cookies = await cookiesFromJar(jar);
      db.cookieJar.update(cookieJar, {cookies});

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

      const responsePatch = {
        parentId: renderedRequest._id,
        statusCode: networkResponse.statusCode,
        statusMessage: networkResponse.statusMessage,
        contentType: networkResponse.headers['content-type'],
        url: config.url, // TODO: Handle redirects somehow
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
