import electron from 'electron';
import * as uuid from 'uuid';
import querystring from 'querystring';

const LOCALSTORAGE_KEY_SESSION_ID = 'insomnia::current-oauth-session-id';
let authWindowSessionId;
if (window.localStorage.getItem(LOCALSTORAGE_KEY_SESSION_ID)) {
  authWindowSessionId = window.localStorage.getItem(LOCALSTORAGE_KEY_SESSION_ID);
} else {
  initNewOAuthSession();
}

export function initNewOAuthSession() {
  // the value of this variable needs to start with 'persist:'
  // otherwise sessions won't be persisted over application-restarts
  authWindowSessionId = `persist:oauth2_${uuid.v4()}`;
  window.localStorage.setItem(LOCALSTORAGE_KEY_SESSION_ID, authWindowSessionId);
}

export function responseToObject(body, keys, defaults = {}) {
  let data = null;
  try {
    data = JSON.parse(body);
  } catch (err) {}

  if (!data) {
    try {
      // NOTE: parse does not return a JS Object, so
      //   we cannot use hasOwnProperty on it
      data = querystring.parse(body);
    } catch (err) {}
  }

  // Shouldn't happen but we'll check anyway
  if (!data) {
    data = {};
  }

  const results = {};
  for (const key of keys) {
    if (data[key] !== undefined) {
      results[key] = data[key];
    } else if (defaults && defaults.hasOwnProperty(key)) {
      results[key] = defaults[key];
    } else {
      results[key] = null;
    }
  }

  return results;
}

export function authorizeUserInWindow(
  url,
  urlSuccessRegex = /(code=).*/,
  urlFailureRegex = /(error=).*/,
) {
  return new Promise((resolve, reject) => {
    let finalUrl = null;

    function _parseUrl(currentUrl, source) {
      if (currentUrl.match(urlSuccessRegex)) {
        console.log(
          `[oauth2] ${source}: Matched success redirect to "${currentUrl}" with ${urlSuccessRegex.toString()}`,
        );
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl.match(urlFailureRegex)) {
        console.log(
          `[oauth2] ${source}: Matched error redirect to "${currentUrl}" with ${urlFailureRegex.toString()}`,
        );
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl === url) {
        // It's the first one, so it's not a redirect
        console.log(`[oauth2] ${source}: Loaded "${currentUrl}"`);
      } else {
        console.log(
          `[oauth2] ${source}: Ignoring URL "${currentUrl}". Didn't match ${urlSuccessRegex.toString()}`,
        );
      }
    }

    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        partition: authWindowSessionId,
      },
      show: false,
    });

    // Finish on close
    child.on('close', () => {
      if (finalUrl) {
        resolve(finalUrl);
      } else {
        const errorDescription = 'Authorization window closed';
        reject(new Error(errorDescription));
      }
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', () => {
      // Be sure to resolve URL so that we can handle redirects with no host like /foo/bar
      const currentUrl = child.webContents.getURL();
      _parseUrl(currentUrl, 'did-navigate');
    });

    child.webContents.on('will-redirect', (e, url) => {
      // Also listen for will-redirect, as some redirections do not trigger 'did-navigate'
      // 'will-redirect' does not cover all cases that 'did-navigate' does, so both events are required
      // GitHub's flow triggers only 'did-navigate', while Microsoft's only 'will-redirect'
      _parseUrl(url, 'will-redirect');
    });

    child.webContents.on('did-fail-load', (e, errorCode, errorDescription, url) => {
      // Listen for did-fail-load to be able to parse the URL even when the callback server is unreachable
      _parseUrl(url, 'did-fail-load');
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(url);
  });
}
