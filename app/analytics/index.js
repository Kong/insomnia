// @flow
import * as google from './google';
import * as models from '../models';
import {ipcRenderer} from 'electron';
import {getAppVersion, getAppPlatform, isDevelopment, GA_ID, GA_HOST} from '../common/constants';
import {GoogleAnalytics} from './google';

let analytics = null;

const DIMENSION_PLATFORM = 1;
const DIMENSION_VERSION = 2;

export async function init (accountId: ?string) {
  const settings = await models.settings.getOrCreate();

  if (settings.disableAnalyticsTracking) {
    console.log(`[ga] Not initializing due to user settings`);
    return;
  }

  if (analytics) {
    analytics = new GoogleAnalytics(
      GA_ID,
      settings.deviceId || settings._id,
      `https://${GA_HOST}/`
    );
    analytics.setCustomDimension(DIMENSION_PLATFORM, getAppPlatform());
    analytics.setCustomDimension(DIMENSION_VERSION, getAppVersion());
  }

  ipcRenderer.on('analytics-track-event', (_, args) => {
    analytics.trackEvent(...args);
  });

  if (window && !isDevelopment()) {
    window.addEventListener('error', e => {
      trackEvent('Error', 'Uncaught Error');
      console.error('Uncaught Error', e);
    });

    window.addEventListener('unhandledrejection', e => {
      trackEvent('Error', 'Uncaught Promise');
      console.error('Unhandled Promise', e);
    });
  }
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
