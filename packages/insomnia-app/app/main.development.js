// @flow
import needsRestart from 'electron-squirrel-startup';
import * as electron from 'electron';
import * as errorHandling from './main/error-handling';
import * as updates from './main/updates';
import * as windowUtils from './main/window-utils';
import * as models from './models/index';
import * as database from './common/database';
import {
  CHANGELOG_BASE_URL,
  getAppVersion,
  isDevelopment,
  isMac
} from './common/constants';
import type { ToastNotification } from './ui/components/toast';
import type { Stats } from './models/stats';

// Handle potential auto-update
if (needsRestart) {
  process.exit(0);
}

const { app, ipcMain, session } = electron;
const commandLineArgs = process.argv.slice(1);

// So if (window) checks don't throw
global.window = global.window || undefined;

// When the app is first launched
app.on('ready', async () => {
  // Init some important things first
  await database.init(models.types());
  await errorHandling.init();
  await windowUtils.init();

  // Init the app
  await _trackStats();
  await _launchApp();

  // Init the rest
  await updates.init();
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
  app.makeSingleInstance(args => {
    args.length && window.send('run-command', args[0]);
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
    delete details.requestHeaders['Origin'];
    fn({ cancel: false, requestHeaders: details.requestHeaders });
  });
}

async function _trackStats() {
  // Handle the stats
  const oldStats = await models.stats.get();
  const stats: Stats = await models.stats.update({
    currentLaunch: Date.now(),
    lastLaunch: oldStats.currentLaunch,
    currentVersion: getAppVersion(),
    lastVersion: oldStats.currentVersion,
    launches: oldStats.launches + 1
  });

  // Update Stats Object
  const firstLaunch = stats.launches === 1;
  const justUpdated =
    !firstLaunch && stats.currentVersion !== stats.lastVersion;

  ipcMain.once('window-ready', () => {
    const { currentVersion } = stats;
    if (!justUpdated || !currentVersion) {
      return;
    }

    const { BrowserWindow } = electron;
    const notification: ToastNotification = {
      key: `updated-${currentVersion}`,
      url: `${CHANGELOG_BASE_URL}/${currentVersion}/`,
      cta: "See What's New",
      message: `Updated to ${currentVersion}`,
      email: 'support@insomnia.rest'
    };

    // Wait a bit before showing the user because the app just launched.
    setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.send('show-notification', notification);
      }
    }, 5000);
  });
}
