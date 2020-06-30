import electron from 'electron';
import * as uuid from 'uuid';
import querystring from 'querystring';

const AUTH_WINDOW_SESSION_ID = uuid.v4();

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

    function _parseUrl(currentUrl) {
      if (currentUrl.match(urlSuccessRegex)) {
        console.log(
          `[oauth2] Matched success redirect to "${currentUrl}" with ${urlSuccessRegex.toString()}`,
        );
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl.match(urlFailureRegex)) {
        console.log(
          `[oauth2] Matched error redirect to "${currentUrl}" with ${urlFailureRegex.toString()}`,
        );
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl === url) {
        // It's the first one, so it's not a redirect
        console.log(`[oauth2] Loaded "${currentUrl}"`);
      } else {
        console.log(
          `[oauth2] Ignoring URL "${currentUrl}". Didn't match ${urlSuccessRegex.toString()}`,
        );
      }
    }

    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        partition: `oauth2_${AUTH_WINDOW_SESSION_ID}`,
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
      _parseUrl(currentUrl);
    });

    child.webContents.on('did-fail-load', (e, errorCode, errorDescription, url) => {
      // Listen for did-fail-load to be able to parse the URL even when the callback server is unreachable
      _parseUrl(url);
    });

    const options = {};

    // Force user-agent for GitHub until we update Chromium version. Note, we don't do this for
    // everything because it breaks things. https://github.com/kong/insomnia/issues/1816
    if (url.includes('github.com')) {
      options.userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, ' +
        'like Gecko) Chrome/78.0.3904.108 Safari/537.36';
    }

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(url, options);
  });
}
