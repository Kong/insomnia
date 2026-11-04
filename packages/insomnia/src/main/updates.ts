import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import type { Settings } from 'insomnia-data';
import { services } from 'insomnia-data';

import appConfig from '../../config/config.json';
import packageJSON from '../../package.json';
import { CHECK_FOR_UPDATES_INTERVAL, isDevelopment, type UpdateStatus } from '../common/constants';
import { backup } from './backup';
import { ipcMainOn } from './ipc/electron';

const showUpdateStatusToast = (title: string, description?: string) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('show-toast', {
      content: {
        title,
        description,
        status: 'info',
      },
    });
  }
};

const isUpdateSupported = () => {
  if (process.env['ALLOW_UPDATES_IN_DEV']) {
    return true;
  }
  if (process.env.INSOMNIA_DISABLE_AUTOMATIC_UPDATES || isDevelopment() || !app.isPackaged) {
    return false;
  }
  // Only AppImage can replace itself on Linux; distro packages are updated by the package manager.
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    return false;
  }
  return !(process.platform === 'win32' && process.env['PORTABLE_EXECUTABLE_DIR']);
};

let currentUpdateStatus: UpdateStatus = 'idle';

const sendUpdateStatus = (status: UpdateStatus) => {
  currentUpdateStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('update-status-changed', status);
  }
};

const checkForUpdates = async (settings: Settings) => {
  try {
    autoUpdater.allowPrerelease = settings.updateChannel === 'beta';
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[updater] Failed to check for updates:', err.message);
    sendUpdateStatus('idle');
    showUpdateStatusToast('Update Error', err.message);
  }
};

const createListeners = () => {
  autoUpdater.on('error', error => {
    console.warn(`[updater] Error: ${error.message}`);
    sendUpdateStatus('idle');
    showUpdateStatusToast('Update Error', error.message);
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('idle');
    showUpdateStatusToast('Up to Date', packageJSON.version);
  });
  autoUpdater.on('update-available', () => {
    sendUpdateStatus('downloading');
    showUpdateStatusToast('Downloading update...');
  });
  autoUpdater.on('update-downloaded', async ({ version }) => {
    await backup();
    sendUpdateStatus('readyToRestart');
    showUpdateStatusToast(`Downloaded ${version}`, 'Restart to apply the update.');
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: `New version: ${version}`,
      detail: `A new version of ${appConfig.productName} has been downloaded. Restart to apply it.`,
    });
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
};

export const init = async () => {
  autoUpdater.logger = log;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.setFeedURL({ provider: 'github', owner: appConfig.githubOrg, repo: appConfig.githubRepo });
  createListeners();

  const updateSupported = isUpdateSupported();
  const settings = await services.settings.get();
  if (updateSupported) {
    if (settings.updateAutomatically) {
      checkForUpdates(settings);
    }
    setInterval(async () => {
      const settings = await services.settings.get();
      if (settings.updateAutomatically) {
        checkForUpdates(settings);
      }
    }, CHECK_FOR_UPDATES_INTERVAL);
  }

  ipcMainOn('getUpdateStatus', event => {
    event.returnValue = currentUpdateStatus;
  });
  ipcMainOn('applyUpdateAndRestart', () => {
    if (currentUpdateStatus === 'readyToRestart') {
      autoUpdater.quitAndInstall();
    }
  });
  ipcMainOn('manualUpdateCheck', async () => {
    if (!updateSupported) {
      showUpdateStatusToast('Updates are not available for this build');
      return;
    }
    sendUpdateStatus('checking');
    showUpdateStatusToast('Checking for updates...');
    checkForUpdates(await services.settings.get());
  });
};
