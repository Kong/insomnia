const { parse: urlParse } = require('url');
const zlib = require('zlib');

let _userAgent = '';
let _baseUrl = '';
let _commandListeners = [];

module.exports.setup = function(userAgent, baseUrl) {
  _userAgent = userAgent;
  _baseUrl = baseUrl;
};

module.exports.onCommand = function(callback) {
  _commandListeners.push(callback);
};

module.exports.post = async function(path, obj, sessionId, compressBody = false) {
  return _fetch('POST', path, obj, sessionId, compressBody);
};

module.exports.put = async function(path, obj, sessionId, compressBody = false) {
  return _fetch('PUT', path, obj, sessionId, compressBody);
};

module.exports.get = async function(path, sessionId) {
  return _fetch('GET', path, null, sessionId);
};

async function _fetch(method, path, obj, sessionId, compressBody = false) {
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
