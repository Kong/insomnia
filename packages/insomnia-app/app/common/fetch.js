import 'whatwg-fetch';
import { parse as urlParse } from 'url';
import { getClientString } from './constants';
import * as session from '../sync/session';
import * as zlib from 'zlib';

let commandListeners = [];

export function onCommand(callback) {
  commandListeners.push(callback);
}

export function offCommand(callback) {
  commandListeners = commandListeners.filter(l => l !== callback);
}

export function post(path, obj) {
  return _fetch('POST', path, obj);
}

export function get(path, sessionId = null) {
  return _fetch('GET', path, null, sessionId);
}

export function del(path, sessionId = null) {
  return _fetch('DELETE', path, null, sessionId);
}

export function put(path, sessionId = null) {
  return _fetch('PUT', path, null, sessionId);
}

export function rawFetch(...args) {
  return window.fetch(...args);
}

async function _fetch(method, path, obj, sessionId = null) {
  const config = {
    method: method,
    headers: new window.Headers()
  };

  // Set some client information
  config.headers.set('X-Insomnia-Client', getClientString());

  if (obj) {
    config.body = zlib.gzipSync(JSON.stringify(obj));
    config.headers.set('Content-Type', 'application/json');
    config.headers.set('Content-Encoding', 'gzip');
  }

  sessionId = sessionId || session.getCurrentSessionId();
  if (sessionId) {
    config.headers.set('X-Session-Id', sessionId);
  }

  const response = await window.fetch(_getUrl(path), config);
  const uri = response.headers.get('x-insomnia-command');
  uri && _notifyCommandListeners(uri);

  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    err.statusCode = response.status;
    throw err;
  }

  if (
    response.headers.get('content-type') === 'application/json' ||
    path.match(/\.json$/)
  ) {
    return response.json();
  } else {
    return response.text();
  }
}

function _getUrl(path) {
  const baseUrl = process.env.INSOMNIA_SYNC_URL || 'https://api.insomnia.rest';
  return `${baseUrl}${path}`;
}

function _notifyCommandListeners(uri) {
  const parsed = urlParse(uri, true);

  const command = `${parsed.hostname}${parsed.pathname}`;
  const args = JSON.parse(JSON.stringify(parsed.query));

  commandListeners.map(fn => fn(command, args));
}
