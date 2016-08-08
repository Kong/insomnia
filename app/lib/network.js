import networkRequest from 'request';
import {CookieJar} from 'tough-cookie';

import * as db from '../database';
import * as querystring from './querystring';
import {DEBOUNCE_MILLIS} from './constants';
import {STATUS_CODE_PEBKAC} from './constants';
import {getRenderedRequest} from './render';
import {extractCookiesFromJar} from './cookies';


function buildRequestConfig (request, patch = {}) {
  const config = {
    method: request.method,
    body: request.body,
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
    rejectUnauthorized: true
  };

  // Set the URL, including the query parameters
  const qs = querystring.buildFromParams(request.parameters);
  config.url = querystring.joinURL(request.url, qs);

  // Set basic auth if we need to
  if (request.authentication.username) {
    config.auth = {
      user: request.authentication.username,
      pass: request.authentication.password
    }
  }

  for (let i = 0; i < request.headers.length; i++) {
    let header = request.headers[i];
    if (header.name) {
      config.headers[header.name] = header.value;
    }
  }

  return Object.assign(config, patch);
}

function actuallySend (request, settings, cookieJar) {
  return new Promise((resolve, reject) => {
    const jar = networkRequest.jar();

    try {
      jar._jar = CookieJar.fromJSON(cookieJar.data);
    } catch (e) {
      console.log('Failed to initialize cookie jar', e);
    }

    let config = buildRequestConfig(request, {
      jar: jar,
      followAllRedirects: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null,
      rejectUnauthorized: settings.validateSSL
    }, true);

    const startTime = Date.now();
    // TODO: Handle redirects ourselves
    networkRequest(config, function (err, networkResponse) {
      if (err) {
        db.responseCreate({
          parentId: request._id,
          elapsedTime: Date.now() - startTime,
          error: err.toString()
        });
        console.warn(`Request to ${config.url} failed`, err);
        return reject(err);
      }

      console.log("NETWORK RESPONSE", networkResponse);
      global.cookieJar = jar;
      extractCookiesFromJar(jar);
      db.cookieJarUpdate(cookieJar, {data: jar._jar.toJSON()}).then(j => console.log(j));

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
        parentId: request._id,
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
          db.settingsGet(),
          db.cookieJarAll()
        ]).then(([request, settings, cookieJars]) => {
          return getRenderedRequest(request).then(renderedRequest => {
            actuallySend(renderedRequest, settings, cookieJars[0]).then(resolve, reject);
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
