import networkRequest from 'request';

import * as db from '../database';
import * as querystring from './querystring';
import {render} from './render';
import {DEBOUNCE_MILLIS} from './constants';
import {STATUS_CODE_PEBKAC} from './constants';
import {getRenderedRequest} from './render';

function buildRequestConfig (request, patch = {}) {
  const config = {
    method: request.method,
    body: request.body,
    headers: {},

    // Setup redirect rules
    followRedirect: true,
    maxRedirects: 10,
    timeout: -1,

    // Unzip gzipped responses
    gzip: true
  };

  // Set the URL, including the query parameters
  const qs = querystring.buildFromParams(request.parameters);
  config.url = querystring.joinURL(request.url, qs);

  // Default the proto if it doesn't exist
  if (config.url.indexOf('://') === -1) {
    config.url = `https://${config.url}`;
  }

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

function actuallySend (request, settings) {
  return new Promise((resolve, reject) => {

    let config = buildRequestConfig(request, {
      jar: networkRequest.jar(),
      followRedirect: settings.followRedirects,
      timeout: settings.timeout > 0 ? settings.timeout : null
    }, true);

    const startTime = Date.now();
    networkRequest(config, function (err, response) {
      if (err) {
        db.responseCreate({
          parentId: request._id,
          millis: Date.now() - startTime,
          error: err.toString()
        });
        console.warn(`Request to ${config.url} failed`, err);
        return reject(err);
      }
      const responsePatch = {
        parentId: request._id,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        contentType: response.headers['content-type'],
        url: request.url,
        millis: Date.now() - startTime,
        bytes: response.connection.bytesRead,
        body: response.body,
        headers: Object.keys(response.headers).map(name => {
          const value = response.headers[name];
          return {name, value};
        })
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
        db.settingsGet()
      ]).then(([
        request,
        settings
      ]) => {
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
  });
}
