import networkRequest from 'request'
import render from './render'
import * as db from '../database'

function actuallySend (unrenderedRequest, callback, context = {}) {
  // SNEAKY HACK: Render nested object by converting it to JSON then rendering
  const template = JSON.stringify(unrenderedRequest);
  const request = JSON.parse(render(template, context));

  const config = {
    method: request.method,
    body: request.body,
    headers: {}
  };

  // Default the proto if it doesn't exist
  if (request.url.indexOf('://') === -1) {
    config.url = `https://${request.url}`;
  } else {
    config.url = request.url;
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

  // TODO: this needs to account for existing URL params
  config.url += request.params.map((p, i) => {
    const name = encodeURIComponent(p.name);
    const value = encodeURIComponent(p.value);
    return `${i === 0 ? '?' : '&'}${name}=${value}`;
  }).join('');

  const startTime = Date.now();
  networkRequest(config, function (err, response) {
    if (err) {
      console.error('Request Failed', err, response);
    } else {
      db.responseCreate({
        parentId: request._id,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        contentType: response.headers['content-type'],
        millis: Date.now() - startTime,
        bytes: response.connection.bytesRead,
        body: response.body,
        headers: Object.keys(response.headers).map(name => {
          const value = response.headers[name];
          return {name, value};
        })
      });
    }
    
    callback(err);
  });
}

export function send (request, callback) {
  if (request.parentId) {
    db.get(request.parentId).then(
      requestGroup => actuallySend(request, callback, requestGroup.environment)
    );
  } else {
    actuallySend(request, callback)
  }
}
