import electron from 'electron';
import querystring from 'querystring';
import * as uuid from 'uuid';

import * as models from '../../models/index';

export enum ChromiumVerificationResult {
  BLIND_TRUST = 0,
  USE_CHROMIUM_RESULT = -3
}

/**
 * @deprecated oauth session ids no longer stored in the database. This key is kept for migration purposes and unit tests.
 */
export const LEGACY_LOCALSTORAGE_KEY_SESSION_ID = 'insomnia::current-oauth-session-id';

async function migrateOAuthSessionIntoDatabase() {
  const fromLocalStorage = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY_SESSION_ID);

  if (fromLocalStorage) {
    await models.settings.patch({ oAuthSessionId: fromLocalStorage });
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY_SESSION_ID);
  }
}

export async function initOAuthSession() {
  await migrateOAuthSessionIntoDatabase();

  const { clearOAuth2SessionOnRestart } = await models.settings.getOrCreate();

  if (clearOAuth2SessionOnRestart) {
    await createNewOAuthSession();
  }
}

export async function createNewOAuthSession() {
  const { oAuthSessionId } = await models.settings.patch({ oAuthSessionId: uuid.v4() });

  return oAuthSessionId;
}

export function responseToObject(body, keys, defaults = {}) {
  let data: querystring.ParsedUrlQuery | null = null;

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
    } else if (defaults?.hasOwnProperty(key)) {
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
  return new Promise<string>(async (resolve, reject) => {
    let finalUrl: string | null = null;

    // Fetch user setting to determine whether to validate SSL certificates during auth
    const {
      validateAuthSSL,
      oAuthSessionId,
    } = await models.settings.getOrCreate();

    const authWindowSessionId = oAuthSessionId || await createNewOAuthSession();

    // Create a child window
    const { BrowserWindow } = electron.remote || electron;
    const child = new BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        partition: authWindowSessionId,
      },
      show: false,
    });

    function _parseUrl(currentUrl: string, source: string) {
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
    child.webContents.on('will-redirect', (_error, url) => {
      // Also listen for will-redirect, as some redirections do not trigger 'did-navigate'
      // 'will-redirect' does not cover all cases that 'did-navigate' does, so both events are required
      // GitHub's flow triggers only 'did-navigate', while Microsoft's only 'will-redirect'
      _parseUrl(url, 'will-redirect');
    });
    child.webContents.on('did-fail-load', (_error, _errorCode, _errorDescription, url) => {
      // Listen for did-fail-load to be able to parse the URL even when the callback server is unreachable
      _parseUrl(url, 'did-fail-load');
    });
    child.webContents.session.setCertificateVerifyProc((_request, callback) => {
      if (validateAuthSSL) {
        // Use results of Chromium's cert verification
        callback(ChromiumVerificationResult.USE_CHROMIUM_RESULT);
      } else {
        // Don't verify; blindly trust cert
        callback(ChromiumVerificationResult.BLIND_TRUST);
      }
    });
    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));

    try {
      await child.loadURL(url);
    } catch (e) {
      // Reject with error to show result in OAuth2 tab
      reject(e);
      // Need to close child window here since an exception in loadURL precludes normal call in
      // _parseUrl
      child.close();
    }
  });
}
