import {isDevelopment} from '../appInfo';
import * as session from './session';
import * as appInfo from '../appInfo';

export function fetchPost (path, obj) {
  return _fetch('POST', path, obj)
}

export function fetchGet (path, sessionId = null) {
  return _fetch('GET', path, null, sessionId)
}

async function _fetch (method, path, json, sessionId = null) {
  const config = {
    method: method,
    headers: new Headers()
  };

  // Set some client information
  config.headers.set('X-Insomnia-Client', appInfo.getClientString());

  if (json) {
    config.body = JSON.stringify(json, null, 2);
    config.headers.set('Content-Type', 'application/json');
  }

  sessionId = sessionId || session.getCurrentSessionId();
  if (sessionId) {
    config.headers.set('X-Session-Id', sessionId)
  }

  const response = await fetch(_getUrl(path), config);

  if (response.status === 403) {
    // TODO: Somehow signal the user to login
  }

  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    throw err
  }

  if (response.headers.get('content-type') === 'application/json') {
    return response.json()
  } else {
    return response.text()
  }
}

function _getUrl (path) {
  return `http://localhost:8000${path}`;
  // if (isDevelopment()) {
  //   return `http://localhost:8000${path}`;
  // } else {
  //   return `https://insomnia-api.herokuapp.com${path}`;
  // }
}
