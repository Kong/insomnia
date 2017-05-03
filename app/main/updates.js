import electron from 'electron';
import {CHECK_FOR_UPDATES_INTERVAL, getAppVersion, isDevelopment, isLinux} from '../common/constants';

const {autoUpdater, BrowserWindow} = electron;

const UPDATE_URLS = {
  darwin: `https://updates.insomnia.rest/builds/check/mac?v=${getAppVersion()}`,
  linux: `https://updates.insomnia.rest/builds/check/linux?v=${getAppVersion()}`,
  win32: `https://downloads.insomnia.rest/win`
};

let hasPromptedForUpdates = false;

export function init () {
  // Check for updates immediately
  _checkForUpdates();

  // Check for updates on an interval
  setInterval(_checkForUpdates, CHECK_FOR_UPDATES_INTERVAL);

  autoUpdater.on('error', e => {
    // NOTE: Don't report autoUpdater errors to Sentry. They are way too noisy.
    if (isDevelopment()) {
      console.error(e);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('-- Update Not Available --');
  });

  autoUpdater.on('update-available', () => {
    console.log('-- Update Available --');
  });

  autoUpdater.on('update-downloaded', (e, releaseNotes, releaseName, releaseDate, updateUrl) => {
    console.log(`-- Update Downloaded ${releaseName} --`);
    _showUpdateNotification();
  });
}

function _showUpdateNotification () {
  if (hasPromptedForUpdates) {
    return;
  }

  const window = BrowserWindow.getFocusedWindow();
  if (!window || !window.webContents) {
    return;
  }

  window.webContents.send('update-available');
  hasPromptedForUpdates = true;
}

function _checkForUpdates () {
  if (hasPromptedForUpdates) {
    // We've already prompted for updates. Don't bug the user anymore
    return;
  }

  if (isDevelopment()) {
    console.log('-- Skipping update check in Development --');
    return;
  } else {
    console.log('-- Checking for Updates --');
  }

  if (!isLinux()) {
    try {
      autoUpdater.setFeedURL(UPDATE_URLS[process.platform]);
      autoUpdater.checkForUpdates();
    } catch (e) {
      // This will fail in development
    }
  }
}
