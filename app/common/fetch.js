import 'whatwg-fetch';
import {parse as urlParse} from 'url';
import {isDevelopment, getClientString} from './constants';
import * as session from '../sync/session';

let commandListeners = [];
export function onCommand (callback) {
  commandListeners.push(callback);
}

export function offCommand (callback) {
  commandListeners = commandListeners.filter(l => l !== callback);
}

export function post (path, obj) {
  return _fetch('POST', path, obj)
}

export function get (path, sessionId = null) {
  return _fetch('GET', path, null, sessionId)
}

export function del (path, sessionId = null) {
  return _fetch('DELETE', path, null, sessionId)
}

export function put (path, sessionId = null) {
  return _fetch('PUT', path, null, sessionId)
}

async function _fetch (method, path, json, sessionId = null) {
  const config = {
    method: method,
    headers: new Headers()
  };

  // Set some client information
  config.headers.set('X-Insomnia-Client', getClientString());

  if (json) {
    config.body = JSON.stringify(json, null, 2);
    config.headers.set('Content-Type', 'application/json');
  }

  sessionId = sessionId || session.getCurrentSessionId();
  if (sessionId) {
    config.headers.set('X-Session-Id', sessionId)
  }

  const response = await fetch(_getUrl(path), config);
  const uri = response.headers.get('x-insomnia-command');
  uri && _notifyCommandListeners(uri);

  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    err.statusCode = response.status;
    throw err
  }

  if (response.headers.get('content-type') === 'application/json') {
    return response.json()
  } else {
    return response.text()
  }
}

function _getUrl (path) {
  if (isDevelopment()) {
    return `http://localhost:8000${path}`;
  } else {
    return `https://api.insomnia.rest${path}`;
  }
}

function _notifyCommandListeners (uri) {
  const parsed = urlParse(uri, true);

  const command = `${parsed.hostname}${parsed.pathname}`;
  const args = JSON.parse(JSON.stringify(parsed.query));

  commandListeners.map(fn => fn(command, args));
}

