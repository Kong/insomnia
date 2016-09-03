import networkRequest from 'request';
import {parse as urlParse, format as urlFormat} from 'url';

import * as db from '../database';
import * as querystring from './querystring';
import {DEBOUNCE_MILLIS} from './constants';
import {STATUS_CODE_PEBKAC} from './constants';
import {getRenderedRequest} from './render';
import {jarFromCookies, cookiesFromJar} from './cookies';


function buildRequestConfig (renderedRequest, patch = {}) {
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

  // Encode path portion of URL
  const parsedUrl = urlParse(url);
  parsedUrl.pathname = encodeURI(parsedUrl.pathname);
  config.url = urlFormat(parsedUrl);

  for (let i = 0; i < renderedRequest.headers.length; i++) {
    let header = renderedRequest.headers[i];
    if (header.name) {
      config.headers[header.name] = header.value;
    }
  }

  return Object.assign(config, patch);
}

function actuallySend (renderedRequest, settings) {
  return new Promise((resolve, reject) => {
    const cookieJar = renderedRequest.cookieJar;
    const jar = jarFromCookies(cookieJar.cookies);

    // Detect and set the proxy based on the request protocol
    // NOTE: request does not have a separate settings for http/https proxies
    const {protocol} = urlParse(renderedRequest.url);
    const proxyHost = protocol === 'https:' ? settings.httpsProxy : settings.httpProxy;
    const proxy = proxyHost ? `${protocol}//${proxyHost}` : null;

    let config = buildRequestConfig(renderedRequest, {
      jar: jar,
      proxy: proxy,
      followAllRedirects: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null,
      rejectUnauthorized: settings.validateSSL
    }, true);

    const startTime = Date.now();
    // TODO: Handle redirects ourselves
    networkRequest(config, function (err, networkResponse) {
      if (err) {
        db.responseCreate({
          parentId: renderedRequest._id,
          elapsedTime: Date.now() - startTime,
          error: err.toString()
        });
        return reject(err);
      }

      // TODO: Add image support to Insomnia
      const contentType = networkResponse.headers['content-type'];
      if (contentType && contentType.toLowerCase().indexOf('image/') === 0) {
        const err = new Error(`Content-Type ${contentType} not supported`);

        db.responseCreate({
          parentId: renderedRequest._id,
          elapsedTime: Date.now() - startTime,
          error: err.toString(),
          statusMessage: 'UNSUPPORTED'
        });

        return reject(err);
      }

      // Update the cookie jar
      cookiesFromJar(jar).then(cookies => {
        db.cookieJarUpdate(cookieJar, {cookies});
      });

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

      db.responseCreate(responsePatch).then(resolve, reject);
    })
  })
}

export function send (requestId) {
  return new Promise((resolve, reject) => {

      // First, lets wait for all debounces to finish
      setTimeout(() => {
        Promise.all([
          db.requestGetById(requestId),
          db.settingsGetOrCreate()
        ]).then(([request, settings]) => {
          getRenderedRequest(request).then(renderedRequest => {
            actuallySend(renderedRequest, settings).then(resolve, reject);
          }, err => {
            db.responseCreate({
              parentId: request._id,
              statusCode: STATUS_CODE_PEBKAC,
              error: err.message
            }).then(resolve, reject);
          });
        })
      }, DEBOUNCE_MILLIS);
    }
  )
}
