import electron from 'electron';
import * as querystring from '../common/querystring';
import {parse as urlParse} from 'url';

const DEFAULT_RESPONSE_TYPE = 'code';
const DEFAULT_REDIRECT_URI = 'https://insomnia.rest/';

const Q_ACCESS_TOKEN = 'access_token';
const Q_CLIENT_ID = 'client_id';
const Q_CLIENT_SECRET = 'client_secret';
const Q_CODE = 'code';
const Q_ERROR = 'error';
const Q_ERROR_DESCRIPTION = 'error_description';
const Q_ERROR_URI = 'error_uri';
const Q_REDIRECT_URI = 'redirect_uri';
const Q_RESPONSE_TYPE = 'response_type';
const Q_SCOPE = 'scope';
const Q_STATE = 'state';
const Q_TOKEN_TYPE = 'token_type';

// const Q_GRANT_TYPE = 'grant_type';
// const Q_EXPIRES_IN = 'expires_in';
// const Q_USERNAME = 'username';
// const Q_PASSWORD = 'password';
// const Q_REFRESH_TOKEN = 'password';

/**
 * Make an OAuth2 authorization request
 * @param {string} url - url to perform authorization with
 * @param {string} clientId - client_id of the application
 * @param {string} [redirectUri] - redirect_uri to send code to
 * @param {string} [scope] - OAuth2 scope
 * @param {string} [state] - OAuth2 state
 * @returns {Promise}
 */
export function authorize (url, clientId, redirectUri = DEFAULT_REDIRECT_URI, scope = '', state = '') {
  return new Promise(resolve => {
    const params = [{name: Q_RESPONSE_TYPE, value: DEFAULT_RESPONSE_TYPE}];

    // Add optional params
    clientId && params.push({name: Q_CLIENT_ID, value: clientId});
    redirectUri && params.push({name: Q_REDIRECT_URI, value: redirectUri});
    scope && params.push({name: Q_SCOPE, value: scope});
    state && params.push({name: Q_STATE, value: state});

    // Add query params to URL
    const qs = querystring.buildFromParams(params);
    const finalUrl = querystring.joinUrl(url, qs);

    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {nodeIntegration: false},
      show: false
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', () => {
      const url = child.webContents.getURL();
      if (url.includes(redirectUri)) {
        const {query} = urlParse(url, true);
        resolve({
          code: query[Q_CODE] || null,
          state: query[Q_STATE] || null
        });

        child.close();
      } else {
        // TODO: Add error redirect handling
      }
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(finalUrl);
  });
}

/**
 * Get an OAuth2 auth token
 * @param {string} url
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} code
 * @param {string} [redirectUri]
 * @param {string} [state]
 * @returns {{}}
 */
export async function refresh (url, clientId, clientSecret, code, redirectUri = DEFAULT_REDIRECT_URI, state = '') {
  const params = [
    {name: Q_CLIENT_ID, value: clientId},
    {name: Q_CLIENT_SECRET, value: clientSecret},
    {name: Q_CODE, value: code}
  ];

  // Add optional params
  redirectUri && params.push({name: Q_REDIRECT_URI, value: redirectUri});
  state && params.push({name: Q_STATE, value: state});

  const config = {
    method: 'POST',
    body: querystring.buildFromParams(params),
    headers: new window.Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/x-www-form-urlencoded, application/json'
    })
  };

  const response = await window.fetch(url, config);

  const results = {};
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('json')) {
    const body = await response.json();
    results.accessToken = body[Q_ACCESS_TOKEN];
    results.tokenType = body[Q_TOKEN_TYPE];
    results.scope = body[Q_SCOPE];
    results.error = body[Q_ERROR];
    results.errorUri = body[Q_ERROR_URI];
    results.errorDescription = body[Q_ERROR_DESCRIPTION];
  } else {
    const text = await response.text();
    const body = querystring.deconstructToParams(text);
    results.accessToken = (body.find(p => p.name === Q_ACCESS_TOKEN) || {}).value || null;
    results.tokenType = (body.find(p => p.name === Q_TOKEN_TYPE) || {}).value || null;
    results.scope = (body.find(p => p.name === Q_SCOPE) || {}).value || null;
    results.error = (body.find(p => p.name === Q_ERROR) || {}).value || null;
    results.errorUri = (body.find(p => p.name === Q_ERROR) || {}).value || null;
    results.errorDescription = (body.find(p => p.name === Q_ERROR) || {}).value || null;
  }

  return results;
}
