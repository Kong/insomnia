import electron, { app, session } from 'electron';
import { BrowserWindow } from 'electron';
import contextMenu from 'electron-context-menu';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import fs from 'fs/promises';
import path from 'path';

import { userDataFolder } from '../config/config.json';
import { getAppVersion, getProductName, isDevelopment, isMac } from './common/constants';
import { database } from './common/database';
import log, { initializeLogging } from './common/log';
import { SegmentEvent, trackSegmentEvent } from './main/analytics';
import { registerInsomniaProtocols } from './main/api.protocol';
import { backupIfNewerVersionAvailable } from './main/backup';
import { ipcMainOn, ipcMainOnce, registerElectronHandlers } from './main/ipc/electron';
import { registergRPCHandlers } from './main/ipc/grpc';
import { registerMainHandlers } from './main/ipc/main';
import { registerSecretStorageHandlers } from './main/ipc/secret-storage';
import { registerCurlHandlers } from './main/network/curl';
import { registerWebSocketHandlers } from './main/network/websocket';
import { watchProxySettings } from './main/proxy';
import { initializeSentry, sentryWatchAnalyticsEnabled } from './main/sentry';
import { checkIfRestartNeeded } from './main/squirrel-startup';
import * as updates from './main/updates';
import * as windowUtils from './main/window-utils';
import * as models from './models/index';
import type { Project, RemoteProject } from './models/project';
import type { Stats } from './models/stats';
import type { ToastNotification } from './ui/components/toast';

// Override the Electron userData path
// This makes Chromium use this folder for eg localStorage
// ensure userData dir change is made before configure sentry SDK (https://docs.sentry.io/platforms/javascript/guides/electron/#app-userdata-directory)
const dataPath = process.env.INSOMNIA_DATA_PATH || path.join(app.getPath('userData'), '../', isDevelopment() ? 'insomnia-app' : userDataFolder);
app.setPath('userData', dataPath);

initializeSentry();

registerInsomniaProtocols();

// Handle potential auto-update
if (checkIfRestartNeeded()) {
  process.exit(0);
}

initializeLogging();
log.info(`Running version ${getAppVersion()}`);

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
  registerElectronHandlers();
  registerMainHandlers();
  registergRPCHandlers();
  registerWebSocketHandlers();
  registerCurlHandlers();
  registerSecretStorageHandlers();

  /**
 * There's no option that prevents Electron from fetching spellcheck dictionaries from Chromium's CDN and passing a non-resolving URL is the only known way to prevent it from fetching.
 * see: https://github.com/electron/electron/issues/22995
 * On macOS the OS spellchecker is used and therefore we do not download any dictionary files.
 * This API is a no-op on macOS.
 */
  const disableSpellcheckerDownload = () => {
    electron.session.defaultSession.setSpellCheckerDictionaryDownloadURL(
      'https://00.00/'
    );
  };
  disableSpellcheckerDownload();

  if (isDevelopment()) {
    try {
      const extensions = [REACT_DEVELOPER_TOOLS];
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
  watchProxySettings();
  windowUtils.init();
  await _launchApp();

  // Init the rest
  await updates.init();
  // recursive = ignore already exists error
  await fs.mkdir(path.join(dataPath, 'responses'), { recursive: true });
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
      console.log('[main] creating new window for MacOS activate event');
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
  let window: BrowserWindow;
  // Handle URLs sent via command line args
  ipcMainOnce('halfSecondAfterAppStart', () => {
    console.log('[main] Window ready, handling command line arguments', process.argv);
    const args = process.argv.slice(1).filter(a => a !== '.');
    console.log('[main] Check args and create windows', args);
    if (args.length) {
      window = windowUtils.createWindowsAndReturnMain();
      window.webContents.send('shell:open', args.join());
    }
  });
  // Disable deep linking in playwright e2e tests in order to run multiple tests in parallel
  if (!process.env.PLAYWRIGHT) {
    // Deep linking logic - https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      console.error('[app] Failed to get instance lock');
      app.quit();
    } else {
      // Called when second instance launched with args (Windows/Linux)
      app.on('second-instance', (_1, args) => {
        console.log('[main] Second instance listener received:', args.join('||'));
        window = windowUtils.createWindowsAndReturnMain();
        if (window) {
          if (window.isMinimized()) {
            window.restore();
          }
          window.focus();
        }
        const lastArg = args.slice(-1).join();
        console.log('[main] Open Deep Link URL sent from second instance', lastArg);
        window.webContents.send('shell:open', lastArg);
      });
      window = windowUtils.createWindowsAndReturnMain({ firstLaunch: true });
      const openDeepLinkUrl = (url: string) => {
        console.log('[main] Open Deep Link URL', url);
        window = windowUtils.createWindowsAndReturnMain();
        if (window) {
          if (window.isMinimized()) {
            window.restore();
          }
          window.focus();
        } else {
          window = windowUtils.createWindowsAndReturnMain();
        }
        window.webContents.send('shell:open', url);
      };
      app.on('open-url', (_event, url) => {
        openDeepLinkUrl(url);
      });
      ipcMainOn('openDeepLink', (_event, url) => {
        openDeepLinkUrl(url);
      });
    }
  } else {
    window = windowUtils.createWindowsAndReturnMain();
  }

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
  try {
    const scratchpadProject = await models.project.getById(models.project.SCRATCHPAD_PROJECT_ID);
    const scratchPad = await models.workspace.getById(models.workspace.SCRATCHPAD_WORKSPACE_ID);
    if (!scratchpadProject) {
      console.log('[main] Initializing Scratch Pad Project');
      await models.project.create({ _id: models.project.SCRATCHPAD_PROJECT_ID, name: getProductName(), remoteId: null, parentId: models.organization.SCRATCHPAD_ORGANIZATION_ID });
    }

    if (!scratchPad) {
      console.log('[main] Initializing Scratch Pad');
      await models.workspace.create({ _id: models.workspace.SCRATCHPAD_WORKSPACE_ID, name: 'Scratch Pad', parentId: models.project.SCRATCHPAD_PROJECT_ID, scope: 'collection' });
    }
  } catch (err) {
    console.warn('[main] Failed to create default project. It probably already exists', err);
  }
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

  const localProjects = await database.count<Project>(models.project.type, {
    remoteId: null,
    parentId: { $ne: null },
    _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
  });

  const remoteProjects = await database.count<RemoteProject>(models.project.type, {
    remoteId: { $ne: null },
    parentId: { $ne: null },
  });

  trackSegmentEvent(SegmentEvent.appStarted, {
    localProjects,
    remoteProjects,
    createdRequests: stats.createdRequests,
    deletedRequests: stats.deletedRequests,
    executedRequests: stats.executedRequests,
  });

  ipcMainOnce('halfSecondAfterAppStart', async () => {
    backupIfNewerVersionAvailable();
    const { currentVersion, launches, lastVersion } = stats;

    const firstLaunch = launches === 1;
    const justUpdated = !firstLaunch && currentVersion !== lastVersion;
    if (!justUpdated || !currentVersion) {
      return;
    }
    console.log('[main] App update detected', currentVersion, lastVersion);
    const notification: ToastNotification = {
      key: `updated-${currentVersion}`,
      url: 'https://github.com/Kong/insomnia/releases',
      cta: "See What's New",
      message: `Updated to ${currentVersion}`,
    };
    // Wait a bit before showing the user because the app just launched.
    setTimeout(async () => {
      for (const window of BrowserWindow.getAllWindows()) {
        // @ts-expect-error -- TSCONVERSION likely needs to be window.webContents.send instead
        window.send('show-notification', notification);
      }
    }, 5000);
  });
  return stats;
}
