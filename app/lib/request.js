import networkRequest from 'request'
import render from './render'
import * as db from '../database'

function makeRequest (request, callback) {
  const config = {
    method: request.method,
    body: request.body,
    headers: {}
  };

  if (request.url.indexOf('://') === -1) {
    config.url = request.url;
  } else {
    config.url = `https://${request.url}`;
  }

  if (request.authentication.username) {
    config.auth = {
      user: request.authentication.username,
      pass: request.authentication.password
    }
  }

  // TODO: Do these need to be urlencoded or something?
  for (let i = 0; i < request.headers.length; i++) {
    let header = request.headers[i];
    if (header.name) {
      config.headers[header.name] = header.value;
    }
  }

  // TODO: this is just a POC. It breaks in a lot of cases
  config.url += request.params.map((p, i) => {
    const name = encodeURIComponent(p.name);
    const value = encodeURIComponent(p.value);
    return `${i === 0 ? '?' : '&'}${name}=${value}`;
  }).join('');


  networkRequest(config, function (err, response) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, {
        body: response.body,
        contentType: response.headers['content-type'],
        statusCode: response.statusCode,
        headers: Object.keys(response.headers).map(name => {
          const value = response.headers[name];
          return {name, value};
        })
      });
    }
  });
}

export default function (originalRequest, callback) {
  // SNEAKY HACK: Render nested object by converting it to JSON then rendering
  const template = JSON.stringify(originalRequest);
  const request = JSON.parse(render(template, context));

  if (request.parent) {
    db.get(request.parent).then(
      requestGroup => makeRequest(config, callback, requestGroup.environment)
    );
  } else {
    makeRequest(request, callback)
  }
}
