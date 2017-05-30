import * as google from './google';
import * as models from '../models';
import {ipcRenderer} from 'electron';
import {getAppVersion, getAppPlatform} from '../common/constants';

let initialized = false;
export async function init (accountId) {
  const settings = await models.settings.getOrCreate();

  if (settings.disableAnalyticsTracking) {
    console.log(`[ga] Not initializing due to user settings`);
    return;
  }

  if (initialized) {
    return;
  }

  await google.init(accountId, getAppPlatform(), getAppVersion());

  initialized = true;

  ipcRenderer.on('analytics-track-event', (_, args) => {
    trackEvent(...args);
  });
}

export function trackEvent (...args) {
  // Do on next tick in case it fails or blocks
  process.nextTick(() => {
    google.sendEvent(...args);
  });
}

export function setAccountId (accountId) {
  // Do on next tick in case it fails or blocks
  process.nextTick(() => {
    google.setUserId(accountId);
  });
}
