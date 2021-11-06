import 'core-js/stable';
import 'regenerator-runtime/runtime';

import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import * as electron from 'electron';
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';
import fs, { createWriteStream } from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import { performance } from 'perf_hooks';
import * as stream from 'stream';
import { promisify } from 'util';
import uuid from 'uuid';

import appConfig from '../config/config.json';
import { trackNonInteractiveEventQueueable } from './common/analytics';
import { changelogUrl, getAppVersion, isDevelopment, isMac } from './common/constants';
import { database } from './common/database';
import { disableSpellcheckerDownload, exitAppFailure, getDataDirectory } from './common/electron-helpers';
import log, { initializeLogging } from './common/log';
import { validateInsomniaConfig } from './common/validate-insomnia-config';
import * as errorHandling from './main/error-handling';
import * as grpcIpcMain from './main/grpc-ipc-main';
import { checkIfRestartNeeded } from './main/squirrel-startup';
import * as updates from './main/updates';
import * as windowUtils from './main/window-utils';
import * as models from './models/index';
import { Request } from './models/request';
import type { Stats } from './models/stats';
import { ResponsePatch } from './network/network';
import type { ToastNotification } from './ui/components/toast';

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
  const newPath = path.join(defaultPath, '../', appConfig.userDataFolder);
  app.setPath('userData', newPath);
}

// So if (window) checks don't throw
global.window = global.window || undefined;

// When the app is first launched
app.on('ready', async () => {
  const { error } = validateInsomniaConfig();

  if (error) {
    electron.dialog.showErrorBox(error.title, error.message);
    console.log('[config] Insomnia config is invalid, preventing app initialization');
    exitAppFailure();
    return;
  }

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
app.on('activate', (_error, hasVisibleWindows) => {
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
    // @ts-expect-error -- TSCONVERSION
    commandLineArgs.length && window.send('run-command', commandLineArgs[0]);
  });
  // Called when second instance launched with args (Windows)
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.error('[app] Failed to get instance lock');
    return;
  }

  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  // Handle URLs when app already open
  app.addListener('open-url', (_error, url) => {
    // @ts-expect-error -- TSCONVERSION
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
    await models.settings.patch({
      hasPromptedOnboarding: false,
      // Don't show the analytics preferences prompt as it is part of the onboarding flow
      hasPromptedAnalytics: true,
    });
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

  const transformInsoRequestToAxiosRequest = (request: Request): AxiosRequestConfig => {
    // TODO transform and check request options https://axios-http.com/docs/req_config
    // headers, params, timeout
    return {
      ...request,
      auth: request.authentication,
      data: request.body,
      // ensures an error is not thrown by 4xx and 5xx status code responses
      validateStatus: () => true,
      // allows us to write the chunks to file
      responseType: 'stream',
    };
  };

  ipcMain.handle('request', async (_, request: Request): Promise<ResponsePatch> => {
    const responsesDir = path.join(getDataDirectory(), 'responses');
    mkdirp.sync(responsesDir);
    const bodyPath = path.join(responsesDir, uuid.v4() + '.response');
    // TODO get some debug logging
    const timeline = ['some logs'];
    const timelineStr = JSON.stringify(timeline, null, '\t');
    const timelineHash = crypto.createHash('sha1').update(timelineStr).digest('hex');
    const timelinePath = path.join(responsesDir, timelineHash + '.timeline');
    const writer = createWriteStream(bodyPath);

    const startTime = performance.now();
    const axiosRequest = transformInsoRequestToAxiosRequest(request);
    const response = await axios(axiosRequest);
    response.data.pipe(writer);
    await promisify(stream.finished)(writer);
    const { status, statusText, headers } = response;

    fs.writeFile(timelinePath,
      timelineStr, function(err) {
        if (err) throw err;
        console.log('Saved!');
      });

    return {
      bodyCompression: null,
      bodyPath,
      bytesContent: 169, // TODO
      bytesRead: 169, // TODO
      contentType: headers['content-type'],
      elapsedTime: performance.now() - startTime,
      headers: Object.entries(headers).map(([key, value]) => ({ name: key, value })) as [],
      httpVersion: 'HTTP/2', // NOTE axios doesn't support changing http version
      parentId: request._id,
      settingSendCookies: request.settingSendCookies,
      settingStoreCookies: request.settingStoreCookies,
      statusCode: status,
      statusMessage: statusText,
      timelinePath: timelinePath,
      url: request.url,
    };
  });

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
        // @ts-expect-error -- TSCONVERSION likely needs to be window.webContents.send instead
        window.send('show-notification', notification);
      }
    }, 5000);
  });
  return stats;
}
