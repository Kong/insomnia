'use strict';

const networkRequest = require('request');
const {parse: urlParse, format: urlFormat} = require('url');
const db = require('./database');
const querystring = require('./querystring');
var util = require('./util.js');
const {DEBOUNCE_MILLIS, STATUS_CODE_PEBKAC} = require('./constants');
const {jarFromCookies, cookiesFromJar} = require('./cookies');
const {setDefaultProtocol} = require('./util');
const {getRenderedRequest} = require('./render');

let cancelRequestFunction = null;

module.exports.cancelCurrentRequest = () => {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
};

module.exports._buildRequestConfig = (renderedRequest, patch = {}) => {
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
};

module.exports._actuallySend = (renderedRequest, settings) => {
  return new Promise((resolve, reject) => {
    const cookieJar = renderedRequest.cookieJar;
    const jar = jarFromCookies(cookieJar.cookies);

    // Detect and set the proxy based on the request protocol
    // NOTE: request does not have a separate settings for http/https proxies
    const {protocol} = urlParse(renderedRequest.url);
    const {httpProxy, httpsProxy} = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;

    let config = module.exports._buildRequestConfig(renderedRequest, {
      jar: jar,
      proxy: proxy,
      followAllRedirects: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null,
      rejectUnauthorized: settings.validateSSL
    }, true);

    const startTime = Date.now();
    // TODO: Handle redirects ourselves
    const req = networkRequest(config, function (err, networkResponse) {
      if (err) {
        const isShittyParseError = err.toString() === 'Error: Parse Error';

        let message = err.toString();
        if (isShittyParseError) {
          message = 'Could not parse malformed response.'
        }

        db.response.create({
          parentId: renderedRequest._id,
          elapsedTime: Date.now() - startTime,
          error: message
        });

        return reject(err);
      }

      // TODO: Add image support to Insomnia
      const contentType = networkResponse.headers['content-type'];
      if (contentType && contentType.toLowerCase().indexOf('image/') === 0) {
        const err = new Error(`Content-Type ${contentType} not supported`);

        db.response.create({
          parentId: renderedRequest._id,
          elapsedTime: Date.now() - startTime,
          error: err.toString(),
          statusMessage: 'UNSUPPORTED'
        });

        return reject(err);
      }

      // Update the cookie jar
      cookiesFromJar(jar).then(cookies => {
        db.cookieJar.update(cookieJar, {cookies});
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

      db.response.create(responsePatch).then(resolve, reject);
    });

    // Kind of hacky, but this is how we cancel a request.
    cancelRequestFunction = () => {
      req.abort();

      db.response.create({
        parentId: renderedRequest._id,
        elapsedTime: Date.now() - startTime,
        statusMessage: 'Cancelled',
        error: 'The request was cancelled'
      });

      return reject('Cancelled');
    }
  })
};

module.exports.send = requestId => {
  return new Promise((resolve, reject) => {

    // First, lets wait for all debounces to finish
    setTimeout(() => {
      Promise.all([
        db.request.getById(requestId),
        db.settings.getOrCreate()
      ]).then(([request, settings]) => {
        getRenderedRequest(request).then(renderedRequest => {
          module.exports._actuallySend(renderedRequest, settings).then(resolve, reject);
        }, err => {
          db.response.create({
            parentId: request._id,
            statusCode: STATUS_CODE_PEBKAC,
            error: err.message
          }).then(resolve, reject);
        });
      })
    }, DEBOUNCE_MILLIS);
  })
};
