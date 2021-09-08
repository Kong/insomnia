import electron from 'electron';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';

import {
  CHECK_FOR_UPDATES_INTERVAL,
  getAppId,
  getAppVersion,
  isDevelopment,
  UPDATE_URL_MAC,
  UPDATE_URL_WINDOWS,
  updatesSupported,
} from '../common/constants';
import { delay } from '../common/misc';
import * as models from '../models/index';
const { autoUpdater, BrowserWindow, ipcMain } = electron;

async function getUpdateUrl(force: boolean): Promise<string | null> {
  const platform = process.platform;
  const settings = await models.settings.getOrCreate();
  let updateUrl: string | null = null;

  if (!updatesSupported()) {
    return null;
  }

  if (platform === 'win32') {
    updateUrl = UPDATE_URL_WINDOWS;
  } else if (platform === 'darwin') {
    updateUrl = UPDATE_URL_MAC;
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
      value: settings.updateChannel,
    },
  ];
  const qs = buildQueryStringFromParams(params);
  const fullUrl = joinUrlAndQueryString(updateUrl, qs);
  console.log(`[updater] Using url ${fullUrl}`);

  if (process.env.INSOMNIA_DISABLE_AUTOMATIC_UPDATES) {
    console.log('[updater] Disabled by INSOMNIA_DISABLE_AUTOMATIC_UPDATES environment variable');
    return null;
  }

  if (isDevelopment()) {
    return null;
  }

  if (!force && !settings.updateAutomatically) {
    return null;
  }

  return fullUrl;
}

function _sendUpdateStatus(status) {
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    // @ts-expect-error -- TSCONVERSION seems to be a genuine error
    window.send('updater.check.status', status);
  }
}

function _sendUpdateComplete(success: boolean, msg: string) {
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    // @ts-expect-error -- TSCONVERSION seems to be a genuine error
    window.send('updater.check.complete', success, msg);
  }
}

let hasPromptedForUpdates = false;
export async function init() {
  autoUpdater.on('error', e => {
    console.warn(`[updater] Error: ${e.message}`);
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Not Available');

    _sendUpdateComplete(false, 'Up to Date');
  });
  autoUpdater.on('update-available', () => {
    console.log('[updater] Update Available');

    _sendUpdateStatus('Downloading...');
  });
  autoUpdater.on('update-downloaded', (_error, _releaseNotes, releaseName) => {
    console.log(`[updater] Downloaded ${releaseName}`);

    _sendUpdateComplete(true, 'Updated (Restart Required)');

    _showUpdateNotification();
  });
  ipcMain.on('updater.check', async () => {
    await _checkForUpdates(true);
  });
  // Check for updates on an interval
  setInterval(async () => {
    await _checkForUpdates(false);
  }, CHECK_FOR_UPDATES_INTERVAL);
  // Check for updates immediately
  await _checkForUpdates(false);
}

function _showUpdateNotification() {
  if (hasPromptedForUpdates) {
    return;
  }

  const windows = BrowserWindow.getAllWindows();

  if (windows.length && windows[0].webContents) {
    windows[0].webContents.send('update-available');
  }

  hasPromptedForUpdates = true;
}

async function _checkForUpdates(force: boolean) {
  _sendUpdateStatus('Checking');

  await delay(500);

  if (force) {
    hasPromptedForUpdates = false;
  }

  if (hasPromptedForUpdates) {
    // We've already prompted for updates. Don't bug the user anymore
    return;
  }

  const updateUrl = await getUpdateUrl(force);

  if (updateUrl === null) {
    console.log(
      `[updater] Updater not running platform=${process.platform} dev=${isDevelopment()}`,
    );

    _sendUpdateComplete(false, 'Updates Not Supported');

    return;
  }

  try {
    console.log(`[updater] Checking for updates url=${updateUrl}`);
    // @ts-expect-error -- TSCONVERSION appears to be a genuine error
    autoUpdater.setFeedURL(updateUrl);
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[updater] Failed to check for updates:', err.message);

    _sendUpdateComplete(false, 'Update Error');
  }
}
