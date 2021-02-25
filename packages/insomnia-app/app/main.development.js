// @flow
import { checkIfRestartNeeded } from './main/squirrel-startup';
import { appConfig } from '../config';
import path from 'path';
import * as electron from 'electron';
import * as errorHandling from './main/error-handling';
import * as updates from './main/updates';
import * as grpcIpcMain from './main/grpc-ipc-main';
import * as windowUtils from './main/window-utils';
import * as models from './models/index';
import * as database from './common/database';
import { changelogUrl, getAppVersion, isDevelopment, isMac } from './common/constants';
import type { ToastNotification } from './ui/components/toast';
import type { Stats } from './models/stats';
import { trackNonInteractiveEventQueueable } from './common/analytics';
import log, { initializeLogging } from './common/log';

// Handle potential auto-update
if (checkIfRestartNeeded()) {
  process.exit(0);
}

initializeLogging();

const { app, ipcMain, session } = electron;
const commandLineArgs = process.argv.slice(1);

log.info(`Running version ${getAppVersion()}`);

// Explicitly set userData folder from config because it's sketchy to
// rely on electron-builder to use productName, which could be changed
// by accident.
if (!isDevelopment()) {
  const defaultPath = app.getPath('userData');
  const newPath = path.join(defaultPath, '../', appConfig().userDataFolder);
  app.setPath('userData', newPath);
}

// So if (window) checks don't throw
global.window = global.window || undefined;

// When the app is first launched
app.on('ready', async () => {
  // Init some important things first
  await database.init(models.types());
  await _createModelInstances();

  await errorHandling.init();
  await windowUtils.init();

  // Init the app
  const updatedStats = await _trackStats();
  await _updateFlags(updatedStats);
  await _launchApp();

  // Init the rest
  await updates.init();
  grpcIpcMain.init();
});

// Set as default protocol
app.setAsDefaultProtocolClient(`insomnia${isDevelopment() ? 'dev' : ''}`);

function _addUrlToOpen(e, url) {
  e.preventDefault();
  commandLineArgs.push(url);
}

app.on('open-url', _addUrlToOpen);

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});

// Mac-only, when the user clicks the doc icon
app.on('activate', (e, hasVisibleWindows) => {
  // Create a new window when clicking the doc icon if there isn't one open
  if (!hasVisibleWindows) {
    try {
      windowUtils.createWindow();
    } catch (e) {
      // This might happen if 'ready' hasn't fired yet. So we're just going
      // to silence these errors.
      console.log('[main] App not ready to "activate" yet');
    }
  }
});

function _launchApp() {
  app.removeListener('open-url', _addUrlToOpen);
  const window = windowUtils.createWindow();

  // Handle URLs sent via command line args
  ipcMain.once('window-ready', () => {
    commandLineArgs.length && window.send('run-command', commandLineArgs[0]);
  });

  // Called when second instance launched with args (Windows)
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.error('[app] Failed to get instance lock');
    return;
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  // Handle URLs when app already open
  app.addListener('open-url', (e, url) => {
    window.send('run-command', url);
    // Apparently a timeout is needed because Chrome steals back focus immediately
    // after opening the URL.
    setTimeout(() => {
      window.focus();
    }, 100);
  });

  // Don't send origin header from Insomnia app because we're not technically using CORS
  session.defaultSession.webRequest.onBeforeSendHeaders((details, fn) => {
    delete details.requestHeaders.Origin;
    fn({
      cancel: false,
      requestHeaders: details.requestHeaders,
    });
  });
}

/*
  Only one instance should exist of these models
  On rare occasions, race conditions during initialization result in multiple being created
  To avoid that, create them explicitly prior to any initialization steps
 */
async function _createModelInstances() {
  await models.stats.get();
  await models.settings.getOrCreate();
}

async function _updateFlags({ launches }: Stats) {
  const firstLaunch = launches === 1;
  if (firstLaunch) {
    await models.settings.patch({ hasPromptedOnboarding: false });
  }
}

async function _trackStats(): Promise<Stats> {
  // Handle the stats
  const oldStats = await models.stats.get();
  const stats: Stats = await models.stats.update({
    currentLaunch: Date.now(),
    lastLaunch: oldStats.currentLaunch,
    currentVersion: getAppVersion(),
    lastVersion: oldStats.currentVersion,
    launches: oldStats.launches + 1,
  });

  // Update Stats Object
  const firstLaunch = stats.launches === 1;
  const justUpdated = !firstLaunch && stats.currentVersion !== stats.lastVersion;

  if (firstLaunch) {
    trackNonInteractiveEventQueueable('General', 'First Launch', stats.currentVersion);
  } else if (justUpdated) {
    trackNonInteractiveEventQueueable('General', 'Updated', stats.currentVersion);
  } else {
    trackNonInteractiveEventQueueable('General', 'Launched', stats.currentVersion);
  }

  ipcMain.once('window-ready', () => {
    const { currentVersion } = stats;
    if (!justUpdated || !currentVersion) {
      return;
    }

    const { BrowserWindow } = electron;
    const notification: ToastNotification = {
      key: `updated-${currentVersion}`,
      url: changelogUrl(),
      cta: "See What's New",
      message: `Updated to ${currentVersion}`,
    };

    // Wait a bit before showing the user because the app just launched.
    setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.send('show-notification', notification);
      }
    }, 5000);
  });

  return stats;
}
