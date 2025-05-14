import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

import { CHECK_FOR_UPDATES_INTERVAL } from '../common/constants';
import { delay } from '../common/misc';
import * as models from '../models/index';
import { ipcMainOn } from './ipc/electron';
import { _sendUpdateStatus, isUpdateSupported } from './updates';

export const initNsusUpdater = async () => {
  autoUpdater.on('error', error => {
    console.warn(`[updater] Error: ${error.message}`);
    _sendUpdateStatus('Update Error');
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Not Available');
    _sendUpdateStatus('Up to Date');
  });
  autoUpdater.on('update-available', () => {
    console.log('[updater] Update Available');
    _sendUpdateStatus('Downloading...');
  });
  autoUpdater.on('update-downloaded', async ({ releaseNotes, releaseName }) => {
    console.log(`[updater] Downloaded ${releaseName}`);
    console.log(`[updater] Downloaded ${releaseNotes}`);
    _sendUpdateStatus('Performing backup...');
    _sendUpdateStatus('Updated (Restart Required)');

    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: releaseName || '',
        detail: 'A new version of Insomnia has been downloaded. Restart the application to apply the updates.',
      })
      .then(returnValue => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });
  const settings = await models.settings.get();
  const channel = settings.updateChannel;
  const updateSupported = isUpdateSupported();
  // set auto-update channel
  autoUpdater.channel = channel;

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
    console.log('[updater] Manual update check');

    _sendUpdateStatus('Checking');
    await delay(300); // Pacing
    _checkForUpdates();
  });
};

const _checkForUpdates = () => {
  try {
    console.log(`[updater] Checking for updates`);
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[updater] Failed to check for updates:', err.message);
    _sendUpdateStatus('Update Error');
  }
};
