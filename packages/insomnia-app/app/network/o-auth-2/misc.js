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
      // Be sure to resolve URL so that we can handle redirects with no host like /foo/bar
      const currentUrl = child.webContents.getURL();
      if (currentUrl.match(urlRegex)) {
        console.log(`[oauth2] Matched redirect to "${currentUrl}" with ${urlRegex.toString()}`);
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl === url) {
        // It's the first one, so it's not a redirect
        console.log(`[oauth2] Loaded "${currentUrl}"`);
      } else {
        console.log(`[oauth2] Ignoring URL "${currentUrl}". Didn't match ${urlRegex.toString()}`);
      }
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(url);
  });
}
