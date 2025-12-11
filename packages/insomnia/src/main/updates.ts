import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { app, autoUpdater, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import { autoUpdater as electronUpdater } from 'electron-updater';

import type { Settings } from '~/models/settings';

import appConfig from '../../config/config.json';
import packageJSON from '../../package.json';
import { CHECK_FOR_UPDATES_INTERVAL, isDevelopment } from '../common/constants';
import { delay } from '../common/misc';
import * as models from '../models/index';
import { invariant } from '../utils/invariant';
import { ipcMainOn } from './ipc/electron';

const isUpdateSupported = () => {
  if (process.env['ALLOW_UPDATES_IN_DEV']) {
    showUpdateStatusToast('Dev mode update restriction disabled');
    return true;
  }
  if (process.platform === 'linux') {
    showUpdateStatusToast('Updates disabled on linux');
    return false;
  }
  if (process.env.INSOMNIA_DISABLE_AUTOMATIC_UPDATES) {
    showUpdateStatusToast('Updates disabled by administrator');
    return false;
  }
  if (isDevelopment()) {
    showUpdateStatusToast('Updates disabled in development mode');
    return false;
  }
  // This does not appear to actually be implemented in insomnia.
  // We distribute a regular windows exe which uses appData and an NSIS installer.
  if (process.platform === 'win32' && process.env['PORTABLE_EXECUTABLE_DIR']) {
    showUpdateStatusToast('Updates disabled on portable windows binary');
    return false;
  }
  return true;
};

const getUpdatesBaseURL = process.env.INSOMNIA_UPDATES_URL || 'https://updates.insomnia.rest';
export const getUpdateUrl = (updateChannel: string): string | null => {
  const fullUrl = new URL(
    process.platform === 'win32' ? getUpdatesBaseURL + '/updates/win' : getUpdatesBaseURL + '/builds/check/mac',
  );
  fullUrl.searchParams.append('v', packageJSON.version);
  fullUrl.searchParams.append('app', appConfig.appId);
  fullUrl.searchParams.append('channel', updateChannel);
  console.log(`[updater] Using url ${fullUrl.toString()}`);
  return fullUrl.toString();
};

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

export const init = async () => {
  // nsis installer uses electron-updater package rather than electron.autoUpdater
  const isNsis = await isNsisInstaller();
  const checkForUpdates = isNsis ? initNsisUpdater() : initAutoUpdater();
  const settings = await models.settings.get();
  const updateSupported = isUpdateSupported();
  // perhaps disable this method of upgrading just in case it trigger before backup is complete
  // on app start
  if (updateSupported) {
    if (settings.updateAutomatically) {
      checkForUpdates(settings);
    }
    // on an interval (3h)
    setInterval(async () => {
      const settings = await models.settings.get();
      if (settings.updateAutomatically) {
        checkForUpdates(settings);
      }
    }, CHECK_FOR_UPDATES_INTERVAL);
  }
  // on check now button pushed
  ipcMainOn('manualUpdateCheck', async () => {
    if (!updateSupported) {
      return;
    }
    showUpdateStatusToast('Checking for updates...');

    await delay(300); // Pacing

    checkForUpdates(await models.settings.get());
  });
};

const initAutoUpdater = () => {
  createListeners();
  return (settings: Settings) => {
    try {
      const updateUrl = getUpdateUrl(settings.updateChannel);
      invariant(updateUrl, 'update url is could not be determined');
      console.log(`[updater] Checking for updates url=${updateUrl}`);
      autoUpdater.setFeedURL({ url: updateUrl });
      autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[updater] Failed to check for updates:', err.message);
      showUpdateStatusToast('Update Error', err.message);
    }
  };
};
const createListeners = () => {
  autoUpdater.on('error', error => {
    console.warn(`[updater] Error: ${error.message}`);
    showUpdateStatusToast('Update Error', error.message);
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Not Available');
    showUpdateStatusToast(`Up to Date`, packageJSON.version);
  });
  autoUpdater.on('update-available', () => {
    console.log('[updater] Update Available');
    showUpdateStatusToast('Downloading update...');
  });
  autoUpdater.on('update-downloaded', async (_error, releaseNotes, releaseName) => {
    console.log(`[updater] Downloaded ${releaseName}`);
    showUpdateStatusToast('Performing backup...');
    showUpdateStatusToast(`Downloaded ${releaseName}`, 'Restart to apply the updates.');
    // documented: https://www.electronjs.org/docs/latest/tutorial/updates#step-3-notifying-users-when-updates-are-available
    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version of Insomnia has been downloaded. Restart the application to apply the updates.',
      })
      .then(returnValue => {
        if (returnValue.response === 0) {
          if (process.platform !== 'win32') {
            autoUpdater.quitAndInstall();
            return;
          }
          // Workaround for the windows secure wrapper breaking quitAndInstall logic.
          // This is related to PR 8451 / CVE-2025-1353 / which broke the auto restart after an in-place update
          const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
          spawn(updateExe, ['--processStartAndWait', 'Insomnia.exe'], {
            detached: true,
            windowsHide: true,
          });
          app.quit();
        }
      });
  });
};
const isNsisInstaller = async () => {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const installDir = path.dirname(process.execPath);
    // we inject this file(nsisInstall.nsh) during the NSIS build process to indicate the installer type
    const flagFilePath = path.join(installDir, 'installer-info.json');

    const content = await fs.promises.readFile(flagFilePath, 'utf8');
    const json = JSON.parse(content);
    console.log('installer type', json.installer);
    return json.installer === 'nsis';
  } catch (err) {
    console.warn('Failed to read installer-info.json:', err);
    return false;
  }
};
const initNsisUpdater = () => {
  electronUpdater.logger = log;
  electronUpdater.disableDifferentialDownload = true;
  createNSISListeners();

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

const createNSISListeners = () => {
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
