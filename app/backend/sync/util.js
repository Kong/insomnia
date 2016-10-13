export function fetchPost (path, obj) {
  return _fetch('POST', path, obj)
}

export function fetchGet (path) {
  return _fetch('GET', path, null)
}

async function _fetch (method, path, json) {
  const config = {
    method: method,
    headers: new Headers()
  };

  if (json) {
    config.body = JSON.stringify(json, null, 2);
    config.headers.set('Content-Type', 'application/json');
  }

  const sessionId = localStorage.getItem('sid') || 'no-session';
  if (sessionId) {
    config.headers.set('X-Session-Id', sessionId)
  }

  const response = await fetch(_getUrl(path), config);

  if (!response.ok) {
    throw new Error(`Response ${response.status} for ${path}`)
  }

  if (response.headers.get('content-type') === 'application/json') {
    return response.json()
  } else {
    return response.text()
  }
}

function _getUrl (path) {
  if (window.location.hostname === 'localhost') {
    return `http://localhost:8000/api/v1${path}`;
  } else {
    return `https://insomnia-api.herokuapp.com/api/v1${path}`;
  }
}
