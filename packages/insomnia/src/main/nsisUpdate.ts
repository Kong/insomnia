import { dialog } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

import { CHECK_FOR_UPDATES_INTERVAL } from '../common/constants';
import { delay } from '../common/misc';
import * as models from '../models/index';
import { ipcMainOn } from './ipc/electron';
import { _sendUpdateStatus, isUpdateSupported } from './updates';

export const initNsisUpdater = async () => {
  autoUpdater.logger = log;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on('error', error => {
    console.warn(`[NSIS updater] Error: ${error.message}`);
    _sendUpdateStatus('Update Error');
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[NSIS updater] Not Available');
    _sendUpdateStatus('Up to Date');
  });
  autoUpdater.on('update-available', () => {
    console.log('[NSIS updater] Update Available');
    _sendUpdateStatus('Downloading...');
  });
  autoUpdater.on('update-downloaded', async ({ version }) => {
    console.log(`[NSIS updater] Downloaded ${version}`);
    _sendUpdateStatus('Performing backup...');
    _sendUpdateStatus('Updated (Restart Required)');

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
          autoUpdater.quitAndInstall();
        }
      });
  });
  const settings = await models.settings.get();
  const updateSupported = isUpdateSupported();

  // perhaps disable this method of upgrading just incase it trigger before backup is complete
  // on app start
  if (updateSupported) {
    if (settings.updateAutomatically) {
      _checkForUpdates();
    }
    // on an interval (3h)
    setInterval(async () => {
      const settings = await models.settings.get();
      if (settings.updateAutomatically) {
        _checkForUpdates();
      }
    }, CHECK_FOR_UPDATES_INTERVAL);
  }
  // on check now button pushed
  ipcMainOn('manualUpdateCheck', async () => {
    console.log('[NSIS updater] Manual update check');

    _sendUpdateStatus('Checking');
    await delay(300); // Pacing
    _checkForUpdates();
  });
};

const _checkForUpdates = async () => {
  try {
    console.log(`[NSIS updater] Checking for updates`);
    const settings = await models.settings.get();
    // set auto-update channel
    autoUpdater.channel = settings.updateChannel;
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[NSIS updater] Failed to check for updates:', err.message);
    _sendUpdateStatus('Update Error');
  }
};
