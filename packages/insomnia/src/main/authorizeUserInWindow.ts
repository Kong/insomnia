import { BrowserWindow, dialog } from 'electron';

import * as models from '../models';

export enum ChromiumVerificationResult {
  BLIND_TRUST = 0,
  USE_CHROMIUM_RESULT = -3
}

export enum URLLoadErrorCodes {
  /**
   * An operation was aborted (due to user action).
   * Error code generated from Electron or Chromium. e.g. redirect
   * - https://www.electronjs.org/docs/latest/api/web-contents#event-did-fail-load
   * - https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h
   */
  ERR_ABORTED = -3
}

export function authorizeUserInWindow({
  url,
  urlSuccessRegex = /(code=).*/,
  urlFailureRegex = /(error=).*/,
  sessionId,
}: {
  url: string;
  urlSuccessRegex: RegExp;
  urlFailureRegex: RegExp;
  sessionId: string;
}): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    let finalUrl: string | null = null;

    // Fetch user setting to determine whether to validate SSL certificates during auth
    const {
      validateAuthSSL,
    } = await models.settings.get();

    // Create a child window
    const child = new BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
        partition: sessionId,
      },
      show: false,
    });

    function _parseUrl(currentUrl: string, source: string) {
      if (currentUrl.match(urlSuccessRegex)) {
        console.log(`[oauth2] ${source}: Matched success redirect to "${currentUrl}" with ${urlSuccessRegex.toString()}`,);
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl.match(urlFailureRegex)) {
        console.log(`[oauth2] ${source}: Matched error redirect to "${currentUrl}" with ${urlFailureRegex.toString()}`,);
        finalUrl = currentUrl;
        child.close();
      } else if (currentUrl === url) {
        // It's the first one, so it's not a redirect
        console.log(`[oauth2] ${source}: Loaded "${currentUrl}"`);
      } else {
        console.log(`[oauth2] ${source}: Ignoring URL "${currentUrl}". Didn't match ${urlSuccessRegex.toString()}`,);
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

    // Select client certificate during login if needed.
    // More Info: https://textslashplain.com/2020/05/04/client-certificate-authentication/
    child.webContents.on('select-client-certificate', (event, url, certificateList, callback) => {
      event.preventDefault();

      // There is only a single certificate so just use
      // that certificate without prompting user.
      // In the future maybe this could be a setting?
      if (certificateList.length === 1) {
        callback(certificateList[0]);
        return;
      }

      const buttonLabels = certificateList.map(c => `${c.subjectName} (${c.issuerName})`);
      const cancelId = buttonLabels.length;

      // Prompt the user to select a certificate to use.
      dialog.showMessageBox(child, {
        type: 'none',
        buttons: [...buttonLabels, 'Cancel'],
        cancelId: cancelId,
        message: `The website\n"${url}"\nrequires a client certificate.`,
        detail: 'This website requires a certificate to validate your identity. Select the certificate to use when you connect to this website.',
        textWidth: 300,
      }).then(r => {
        const selectedButtonIndex = r.response;
        // Cancel button clicked
        if (r.response === cancelId) {
          child.close();
          return;
        }
        const selectedCertificate = certificateList[selectedButtonIndex];
        callback(selectedCertificate);
      });
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
    } catch (error) {
      // Ignore the error as the initial url load was aborted on redirect.
      if (error.errno === URLLoadErrorCodes.ERR_ABORTED) {
        return;
      }
      // Reject with error to show result in OAuth2 tab
      reject(error);
      // Need to close child window here since an exception in loadURL precludes normal call in
      // _parseUrl
      child.close();
    }
  });
}
