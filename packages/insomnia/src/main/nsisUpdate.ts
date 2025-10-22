import fs from 'node:fs';
import path from 'node:path';

import { dialog } from 'electron';
import log from 'electron-log';
import { autoUpdater as electronUpdater } from 'electron-updater';

import type { Settings } from '~/models/settings';

import packageJSON from '../../package.json';
import { showUpdateStatusToast } from './updates';

export const isNsisInstaller = async () => {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const installDir = path.dirname(process.execPath);
    // we inject this file(nsisInstall.nsh) during the NSIS build process to indicate the installer type
    const flagFilePath = path.join(installDir, 'installer-info.json');

    const content = await fs.promises.readFile(flagFilePath, 'utf-8');
    const json = JSON.parse(content);
    console.log('installer type', json.installer);
    return json.installer === 'nsis';
  } catch (err) {
    console.warn('Failed to read installer-info.json:', err);
    return false;
  }
};
export const initNsisUpdater = () => {
  electronUpdater.logger = log;
  electronUpdater.disableDifferentialDownload = true;
  createListeners();

  return (settings: Settings) => {
    try {
      console.log(`[NSIS updater] Checking for updates`);
      // set auto-update channel
      electronUpdater.channel = settings.updateChannel;
      electronUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[NSIS updater] Failed to check for updates:', err.message);
      showUpdateStatusToast('Update Error');
    }
  };
};

const createListeners = () => {
  electronUpdater.on('error', error => {
    console.warn(`[updater] Error: ${error.message}`);
    showUpdateStatusToast('Update Error', error.message);
  });
  electronUpdater.on('update-not-available', () => {
    console.log('[updater] Not Available');
    showUpdateStatusToast(`Up to Date`, packageJSON.version);
  });
  electronUpdater.on('update-available', () => {
    console.log('[updater] Update Available');
    showUpdateStatusToast('Downloading update...');
  });
  electronUpdater.on('update-downloaded', async ({ version }) => {
    console.log(`[NSIS updater] Downloaded ${version}`);
    showUpdateStatusToast('Performing backup...');
    showUpdateStatusToast(`Downloaded ${version}`, 'Restart to apply the updates.');
    // documented: https://www.electronjs.org/docs/latest/tutorial/updates#step-3-notifying-users-when-updates-are-available
    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: `New version: ${version}`,
        detail: 'A new version of Insomnia has been downloaded. Restart the application to apply the updates.',
      })
      .then(returnValue => {
        if (returnValue.response === 0) {
          electronUpdater.quitAndInstall();
        }
      });
  });
};
