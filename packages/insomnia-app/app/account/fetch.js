import { delay } from '../common/misc';
import { parse as urlParse } from 'url';
import zlib from 'zlib';

let _userAgent = '';
let _baseUrl = '';
const _commandListeners = [];

export function setup(userAgent, baseUrl) {
  _userAgent = userAgent;
  _baseUrl = baseUrl;
}

export function onCommand(callback) {
  _commandListeners.push(callback);
}

export async function post(path, obj, sessionId, compressBody = false) {
  return _fetch('POST', path, obj, sessionId, compressBody);
}

export async function put(path, obj, sessionId, compressBody = false) {
  return _fetch('PUT', path, obj, sessionId, compressBody);
}

export async function get(path, sessionId) {
  return _fetch('GET', path, null, sessionId);
}

async function _fetch(method, path, obj, sessionId, compressBody = false, retries = 0) {
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }

  const config = {
    method: method,
    headers: {},
  };

  // Set some client information
  if (_userAgent) {
    config.headers['X-Insomnia-Client'] = _userAgent;
  }

  if (obj && compressBody) {
    config.body = zlib.gzipSync(JSON.stringify(obj));
    config.headers['Content-Type'] = 'application/json';
    config.headers['Content-Encoding'] = 'gzip';
  } else if (obj) {
    config.body = JSON.stringify(obj);
    config.headers['Content-Type'] = 'application/json';
  }

  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }

  let response;
  const url = _getUrl(path);
  try {
    response = await window.fetch(url, config);

    // Exponential backoff for 502 errors
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return this._fetch(method, path, obj, sessionId, compressBody, retries);
    }
  } catch (err) {
    throw new Error(`Failed to fetch '${url}'`);
  }
  const uri = response.headers.get('x-insomnia-command');
  uri && _notifyCommandListeners(uri);

  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    err.statusCode = response.status;
    throw err;
  }

  if (response.headers.get('content-type') === 'application/json' || path.match(/\.json$/)) {
    return response.json();
  } else {
    return response.text();
  }
}

function _getUrl(path) {
  if (!_baseUrl) {
    throw new Error('API base URL not configured!');
  }

  return `${_baseUrl}${path}`;
}

function _notifyCommandListeners(uri) {
  const parsed = urlParse(uri, true);

  const command = `${parsed.hostname}${parsed.pathname}`;
  const args = JSON.parse(JSON.stringify(parsed.query));

  _commandListeners.map(fn => fn(command, args));
}
