import electron, { app, ipcMain, session } from 'electron';
import contextMenu from 'electron-context-menu';
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';
import path from 'path';

import appConfig from '../config/config.json';
import { SegmentEvent, trackSegmentEvent } from './common/analytics';
import { changelogUrl, getAppVersion, isDevelopment, isMac } from './common/constants';
import { database } from './common/database';
import { disableSpellcheckerDownload } from './common/electron-helpers';
import log, { initializeLogging } from './common/log';
import { validateInsomniaConfig } from './common/validate-insomnia-config';
import { registerElectronHandlers } from './main/ipc/electron';
import { registergRPCHandlers } from './main/ipc/grpc';
import { registerMainHandlers } from './main/ipc/main';
import { registerWebSocketHandlers } from './main/network/websocket';
import { initializeSentry, sentryWatchAnalyticsEnabled } from './main/sentry';
import { checkIfRestartNeeded } from './main/squirrel-startup';
import * as updates from './main/updates';
import * as windowUtils from './main/window-utils';
import * as models from './models/index';
import type { Stats } from './models/stats';
import type { ToastNotification } from './ui/components/toast';

initializeSentry();

// Handle potential auto-update
if (checkIfRestartNeeded()) {
  process.exit(0);
}

initializeLogging();
const commandLineArgs = process.argv.slice(1);
log.info(`Running version ${getAppVersion()}`);

// Override the Electron userData path
// This makes Chromium use this folder for eg localStorage
const envDataPath = process.env.INSOMNIA_DATA_PATH;
if (envDataPath) {
  app.setPath('userData', envDataPath);
} else {
  // Explicitly set userData folder from config because it's sketchy to rely on electron-builder to use productName, which could be changed by accident.
  const defaultPath = app.getPath('userData');
  const newPath = path.join(defaultPath, '../', isDevelopment() ? 'insomnia-app' : appConfig.userDataFolder);
  app.setPath('userData', newPath);
}

// So if (window) checks don't throw
global.window = global.window || undefined;

// setup right click menu
app.on('web-contents-created', (_, contents) => {
  if (contents.getType() === 'webview') {
    contextMenu({ window: contents });
  } else {
    contextMenu();
  }
});

// When the app is first launched
app.on('ready', async () => {

  const { error } = validateInsomniaConfig();

  if (error) {
    electron.dialog.showErrorBox(error.title, error.message);
    console.log('[config] Insomnia config is invalid, preventing app initialization');
    app.exit(1);
    return;
  }
  registerElectronHandlers();
  registerMainHandlers();
  registergRPCHandlers();
  registerWebSocketHandlers();

  disableSpellcheckerDownload();

  if (isDevelopment()) {
    try {
      const extensions = [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS];
      const extensionsPlural = extensions.length > 0 ? 's' : '';
      const names = await Promise.all(extensions.map(extension => installExtension(extension)));
      console.log(`[electron-extensions] Added DevTools Extension${extensionsPlural}: ${names.join(', ')}`);
    } catch (err) {
      console.log('[electron-extensions] An error occurred: ', err);
    }
  }

  // Init some important things first
  await database.init(models.types());
  await _createModelInstances();
  sentryWatchAnalyticsEnabled();
  windowUtils.init();
  await _launchApp();

  // Init the rest
  await updates.init();
});

// Set as default protocol
const defaultProtocol = `insomnia${isDevelopment() ? 'dev' : ''}`;
const fullDefaultProtocol = `${defaultProtocol}://`;
const defaultProtocolSuccessful = app.setAsDefaultProtocolClient(defaultProtocol);
if (defaultProtocolSuccessful) {
  console.log(`[electron client protocol] successfully set default protocol '${fullDefaultProtocol}'`);
} else {
  console.error(`[electron client protocol] FAILED to set default protocol '${fullDefaultProtocol}'`);
  const isDefaultAlready = app.isDefaultProtocolClient(defaultProtocol);
  if (isDefaultAlready) {
    console.log(`[electron client protocol] the current executable is the default protocol for '${fullDefaultProtocol}'`);
  } else {
    console.log(`[electron client protocol] the current executable is not the default protocol for '${fullDefaultProtocol}'`);
  }

  // Note: `getApplicationInfoForProtocol` is not available on Linux, so we use `getApplicationNameForProtocol` instead
  const applicationName = app.getApplicationNameForProtocol(fullDefaultProtocol);
  if (applicationName) {
    console.log(`[electron client protocol] the default application set for '${fullDefaultProtocol}' is '${applicationName}'`);
  } else {
    console.error(`[electron client protocol] the default application set for '${fullDefaultProtocol}' was not found`);
  }
}

function _addUrlToOpen(event: Electron.Event, url: string) {
  event.preventDefault();
  commandLineArgs.push(url);
}

app.on('open-url', _addUrlToOpen);
// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});
// Mac-only, when the user clicks the doc icon
app.on('activate', (_error, hasVisibleWindows) => {
  // Create a new window when clicking the doc icon if there isn't one open
  if (!hasVisibleWindows) {
    try {
      windowUtils.createWindow();
    } catch (error) {
      // This might happen if 'ready' hasn't fired yet. So we're just going
      // to silence these errors.
      console.log('[main] App not ready to "activate" yet');
    }
  }
});

const _launchApp = async () => {
  await _trackStats();

  app.removeListener('open-url', _addUrlToOpen);
  const window = windowUtils.createWindow();

  // Handle URLs sent via command line args
  ipcMain.once('window-ready', () => {
    // @ts-expect-error -- TSCONVERSION
    commandLineArgs.length && window.send('run-command', commandLineArgs[0]);
  });
  // Called when second instance launched with args (Windows)
  // @TODO: Investigate why this closes electron when using playwright (tested on macOS)
  // and find a better solution.
  if (!process.env.PLAYWRIGHT) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      console.error('[app] Failed to get instance lock');
      return;
    }
  }

  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });
  // Handle URLs when app already open
  app.addListener('open-url', (_event, url) => {
    window.webContents.send('run-command', url);
    // Apparently a timeout is needed because Chrome steals back focus immediately
    // after opening the URL.
    setTimeout(() => {
      window.focus();
    }, 100);
  });
  // Don't send origin header from Insomnia because we're not technically using CORS
  session.defaultSession.webRequest.onBeforeSendHeaders((details, fn) => {
    delete details.requestHeaders.Origin;
    fn({
      cancel: false,
      requestHeaders: details.requestHeaders,
    });
  });
};

/*
  Only one instance should exist of these models
  On rare occasions, race conditions during initialization result in multiple being created
  To avoid that, create them explicitly prior to any initialization steps
 */
async function _createModelInstances() {
  await models.stats.get();
  await models.settings.getOrCreate();
}

async function _trackStats() {
  // Handle the stats
  const oldStats = await models.stats.get();
  const stats: Stats = await models.stats.update({
    currentLaunch: Date.now(),
    lastLaunch: oldStats.currentLaunch,
    currentVersion: getAppVersion(),
    lastVersion: oldStats.currentVersion,
    launches: oldStats.launches + 1,
  });

  trackSegmentEvent(SegmentEvent.appStarted, {}, { queueable: true });

  ipcMain.once('window-ready', () => {
    const { currentVersion, launches, lastVersion } = stats;

    const firstLaunch = launches === 1;
    const justUpdated = !firstLaunch && currentVersion !== lastVersion;
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
        // @ts-expect-error -- TSCONVERSION likely needs to be window.webContents.send instead
        window.send('show-notification', notification);
      }
    }, 5000);
  });
  return stats;
}
