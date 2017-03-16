import electron from 'electron';
import * as querystring from '../common/querystring';
import {parse as urlParse} from 'url';

const Q_CLIENT_ID = 'client_id';
const Q_REDIRECT_URI = 'redirect_uri';
const Q_RESPONSE_TYPE = 'response_type';
const Q_SCOPE = 'scope';
const Q_STATE = 'state';

const DEFAULT_RESPONSE_TYPE = 'code';

// const Q_CLIENT_SECRET = 'client_secret';
// const Q_ERROR = 'error';
// const Q_ERROR_DESCRIPTION = 'error_description';
// const Q_ERROR_URI = 'error_uri';
// const Q_GRANT_TYPE = 'grant_type';
// const Q_CODE = 'code';
// const Q_ACCESS_TOKEN = 'access_token';
// const Q_TOKEN_TYPE = 'token_type';
// const Q_EXPIRES_IN = 'expires_in';
// const Q_USERNAME = 'username';
// const Q_PASSWORD = 'password';
// const Q_REFRESH_TOKEN = 'password';

export function show (url, clientId, redirectUri, scope, state) {
  return new Promise(resolve => {
    const params = [{name: Q_RESPONSE_TYPE, value: DEFAULT_RESPONSE_TYPE}];

    clientId && params.push({name: Q_CLIENT_ID, value: clientId});
    redirectUri && params.push({name: Q_REDIRECT_URI, value: redirectUri});
    scope && params.push({name: Q_SCOPE, value: scope});
    state && params.push({name: Q_STATE, value: state});

    const qs = querystring.buildFromParams(params);
    const finalUrl = querystring.joinUrl(url, qs);

    const child = new electron.remote.BrowserWindow({
      webPreferences: {nodeIntegration: false},
      show: false
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', e => {
      const url = child.webContents.getURL();
      if (url.includes(redirectUri)) {
        const {query} = urlParse(url, true);
        resolve(query.code);
        child.close();
      }
    });

    // Only show the window after it's done loading
    child.on('ready-to-show', () => {
      child.show();
    });

    child.loadURL(finalUrl);
  });
}

window.test = async function () {
  const code = await show(
    'https://github.com/login/oauth/authorize',
    '774e08a9f15ea81fa9af',
    'https://api.insomnia.rest/integrations/github/callback'
  );

  return code;
};
