import electron from 'electron';

import {
  CHECK_FOR_UPDATES_INTERVAL,
  getAppId,
  getAppVersion,
  isDevelopment,
  UpdateURL,
} from '../common/constants';
import { delay } from '../common/misc';
import * as models from '../models/index';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../utils/url/querystring';
import { exportAllWorkspaces } from './export';
const { autoUpdater, BrowserWindow, ipcMain } = electron;
const canUpdate = () => {
  if (process.platform === 'linux') {
    console.log('[updater] Not supported on this platform', process.platform);
    return false;
  }
  if (process.platform === 'win32' && process.env['PORTABLE_EXECUTABLE_DIR']) {
    console.log('[updater] Not supported on portable windows binary');
    return false;
  }
  if (process.env.INSOMNIA_DISABLE_AUTOMATIC_UPDATES) {
    console.log('[updater] Disabled by INSOMNIA_DISABLE_AUTOMATIC_UPDATES environment variable');
    return false;
  }
  if (isDevelopment()) {
    console.log('[updater] Disabled in dev mode');
    return false;
  }
  return true;
};
const getUpdateUrl = (updateChannel: string): string | null => {
  const platform = process.platform;
  let updateUrl: string | null = null;
  if (platform === 'win32') {
    updateUrl = UpdateURL.windows;
  } else if (platform === 'darwin') {
    updateUrl = UpdateURL.mac;
  } else {
    return null;
  }
  const params = [
    {
      name: 'v',
      value: getAppVersion(),
    },
    {
      name: 'app',
      value: getAppId(),
    },
    {
      name: 'channel',
      value: updateChannel,
    },
  ];
  const qs = buildQueryStringFromParams(params);
  const fullUrl = joinUrlAndQueryString(updateUrl, qs);
  console.log(`[updater] Using url ${fullUrl}`);
  return fullUrl;
};

const _sendUpdateStatus = (status: string) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('updater.check.status', status);
  }
};

const _sendUpdateComplete = (msg: string) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('updater.check.complete', msg);
  }
};

let hasDownloadedUpdateAndShownPrompt = false;
export const init = async () => {
  autoUpdater.on('error', error => {
    console.warn(`[updater] Error: ${error.message}`);
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Not Available');
    _sendUpdateComplete('Up to Date');
  });
  autoUpdater.on('update-available', () => {
    console.log('[updater] Update Available');
    _sendUpdateStatus('Downloading...');
  });
  autoUpdater.on('update-downloaded', async (_event, releaseNotes, releaseName) => {
    console.log(`[updater] Downloaded ${releaseName}`, releaseNotes);
    _sendUpdateStatus('Performing backup...');
    await exportAllWorkspaces();
    _sendUpdateComplete('Updated (Restart Required)');
    if (hasDownloadedUpdateAndShownPrompt) {
      return;
    }
    const windows = BrowserWindow.getAllWindows();
    if (windows.length && windows[0].webContents) {
      windows[0].webContents.send('update-available');
    }
    hasDownloadedUpdateAndShownPrompt = true;
  });

  // on app start
  const settings = await models.settings.getOrCreate();
  const updateUrl = getUpdateUrl(settings.updateChannel);
  if (settings.updateAutomatically && updateUrl) {
    _checkForUpdates(updateUrl);
  }
  // on check now button pushed
  ipcMain.on('manualUpdateCheck', async () => {
    const settings = await models.settings.getOrCreate();
    const updateUrl = getUpdateUrl(settings.updateChannel);
    if (!canUpdate() || !updateUrl) {
      _sendUpdateComplete('Updates Not Supported');
      return;
    }
    _sendUpdateStatus('Checking');
    await delay(300); // Pacing
    _checkForUpdates(updateUrl);
  });
  // on an interval (3h)
  if (canUpdate()) {
    setInterval(async () => {
      const settings = await models.settings.getOrCreate();
      const updateUrl = getUpdateUrl(settings.updateChannel);
      if (settings.updateAutomatically && updateUrl) {
        _checkForUpdates(updateUrl);
      }

    }, CHECK_FOR_UPDATES_INTERVAL);
  }
};

const _checkForUpdates = (updateUrl: string) => {
  if (hasDownloadedUpdateAndShownPrompt) {
    return;
  }
  try {
    console.log(`[updater] Checking for updates url=${updateUrl}`);
    autoUpdater.setFeedURL({ url: updateUrl });
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[updater] Failed to check for updates:', err.message);
    _sendUpdateComplete('Update Error');
  }
};
