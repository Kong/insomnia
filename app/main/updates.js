import electron from 'electron';
import {CHECK_FOR_UPDATES_INTERVAL, getAppVersion, isDevelopment, isLinux} from '../common/constants';

const {autoUpdater, BrowserWindow} = electron;

const UPDATE_URLS = isDevelopment() ? {
  darwin: `http://localhost:8000/builds/check/mac?v=${getAppVersion()}`,
  linux: `http://localhost:8000/builds/check/linux?v=${getAppVersion()}`,
  win32: `http://localhost:8000/updates/win?v=${getAppVersion()}`
} : {
  darwin: `https://updates.insomnia.rest/builds/check/mac?v=${getAppVersion()}`,
  linux: `https://updates.insomnia.rest/builds/check/linux?v=${getAppVersion()}`,
  win32: `https://updates.insomnia.rest/updates/win?v=${getAppVersion()}`
};

let hasPromptedForUpdates = false;

export function init () {
  // Check for updates immediately
  _checkForUpdates();

  // Check for updates on an interval
  setInterval(_checkForUpdates, CHECK_FOR_UPDATES_INTERVAL);

  autoUpdater.on('error', e => {
    console.warn(`[updater] Error: ${e.message}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.debug('[updater] Not Available --');
  });

  autoUpdater.on('update-available', () => {
    console.debug('[updater] Update Available --');
  });

  autoUpdater.on('update-downloaded', (e, releaseNotes, releaseName, releaseDate, updateUrl) => {
    console.debug(`[updater] Downloaded ${releaseName} --`);
    _showUpdateNotification();
  });
}

function _showUpdateNotification () {
  if (hasPromptedForUpdates) {
    return;
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length && windows[0].webContents) {
    windows[0].webContents.send('update-available');
  }

  hasPromptedForUpdates = true;
}

function _checkForUpdates () {
  if (hasPromptedForUpdates) {
    // We've already prompted for updates. Don't bug the user anymore
    return;
  }

  if (!isLinux() && !isDevelopment()) {
    try {
      autoUpdater.setFeedURL(UPDATE_URLS[process.platform]);
      autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[updater] Failed to check for updates:', err.message);
    }
  }
}
