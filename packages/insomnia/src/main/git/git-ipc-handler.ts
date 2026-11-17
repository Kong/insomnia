import { BrowserWindow } from 'electron';

import { BaseIpcHandler } from '~/main/ipc/base-ipc-handler';
import { cancelNativeSignIn, onNativeCredentialError, onNativeSignInStatus } from '~/sync/git/providers/native';

/**
 * IPC for git features. Methods delegate to the git modules; keep logic out of here.
 *
 * System Git Credentials: sign-ins performed through `git credential fill` (e.g.
 * waiting for Git Credential Manager) are broadcast on `git.native-sign-in-status`,
 * and the UI can cancel a pending sign-in. Reasons credentials could not be
 * provided are broadcast on `git.native-credential-error`.
 */
export class GitIpcHandler extends BaseIpcHandler {
  channel = 'git';

  constructor() {
    super();
    onNativeSignInStatus(status => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('git.native-sign-in-status', status);
      }
    });
    onNativeCredentialError(error => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('git.native-credential-error', error);
      }
    });
  }

  /** Cancel a System Git Credentials sign-in that is waiting for the user. */
  cancelNativeSignIn(_sender: Electron.WebContents, id: string) {
    cancelNativeSignIn(id);
  }
}
