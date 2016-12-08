import * as segment from './segment';
import * as google from './google';
import {ipcRenderer} from 'electron';
import {getAppVersion, getAppPlatform} from '../common/constants';

let initialized = false;
export async function init (accountId) {
  if (initialized) {
    return;
  }

  process.nextTick(() => {
    google.init(accountId, getAppPlatform(), getAppVersion());
    segment.init();

    initialized = true;
  });

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

export function trackLegacyEvent (event, properties) {
  process.nextTick(() => {
    segment.trackLegacyEvent(event, properties)
  });
}
