import * as electron from 'electron';
import * as querystring from '../../common/querystring';
import * as c from './constants';
import {responseToObject} from './misc';

export default function (authorizationUrl, clientId, redirectUri = '', scope = '', state = '') {
  return new Promise(resolve => {
    const params = [
      {name: c.Q_RESPONSE_TYPE, value: c.RESPONSE_TYPE_TOKEN},
      {name: c.Q_CLIENT_ID, value: clientId}
    ];

    // Add optional params
    redirectUri && params.push({name: c.Q_REDIRECT_URI, value: redirectUri});
    scope && params.push({name: c.Q_SCOPE, value: scope});
    state && params.push({name: c.Q_STATE, value: state});

    // Add query params to URL
    const qs = querystring.buildFromParams(params);
    const finalUrl = querystring.joinUrl(authorizationUrl, qs);

    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {nodeIntegration: false},
      show: false
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', () => {
      const url = child.webContents.getURL();
      const fragment = url.split('#')[1];

      if (fragment) {
        const results = responseToObject(fragment, [
          c.Q_ACCESS_TOKEN,
          c.Q_TOKEN_TYPE,
          c.Q_EXPIRES_IN,
          c.Q_SCOPE,
          c.Q_STATE,
          c.Q_ERROR,
          c.Q_ERROR_DESCRIPTION,
          c.Q_ERROR_URI
        ]);

        resolve(results);
        child.close();
      } else {
        // Bad redirect
      }
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(finalUrl);
  });
}
