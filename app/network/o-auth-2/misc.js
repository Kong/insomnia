import electron from 'electron';
import uuid from 'uuid';
import querystring from 'querystring';

const AUTH_WINDOW_SESSION_ID = uuid.v4();

export function responseToObject (body, keys) {
  let data = null;
  try {
    data = JSON.parse(body);
  } catch (err) {
  }

  if (!data) {
    try {
      data = querystring.parse(body);
    } catch (err) {
    }
  }

  let results = {};
  for (const key of keys) {
    const value = data[key] !== undefined ? data[key] : null;
    results[key] = value;
  }

  return results;
}

export function authorizeUserInWindow (url, urlRegex = /.*/) {
  return new Promise((resolve, reject) => {
    let finalUrl = null;

    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        partition: `oauth2_${AUTH_WINDOW_SESSION_ID}`
      },
      show: false
    });

    // Finish on close
    child.on('close', () => {
      if (finalUrl) {
        resolve(finalUrl);
      } else {
        reject(new Error('Authorization window closed'));
      }
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', () => {
      const url = child.webContents.getURL();
      if (url.match(urlRegex)) {
        finalUrl = url;
        child.close();
      }
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(url);
  });
}
