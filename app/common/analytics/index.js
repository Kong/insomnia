// @flow
import * as models from '../../models/index';
import uuid from 'uuid';
import {GoogleAnalytics} from './google';
import {GA_ID, GA_LOCATION, getAppPlatform, getAppVersion, isDevelopment} from '../constants';

let analytics = null;

const DIMENSION_PLATFORM = 1;
const DIMENSION_VERSION = 2;

export async function init (accountId: ?string) {
  let settings = await models.settings.getOrCreate();

  // Migrate old GA ID into settings model
  let {deviceId, disableAnalyticsTracking} = settings;
  if (!deviceId) {
    const oldId = window.localStorage['gaClientId'] || null;
    deviceId = oldId || uuid.v4();
    await models.settings.update(settings, {deviceId});
  }

  if (!analytics) {
    analytics = new GoogleAnalytics(GA_ID, deviceId, GA_LOCATION, disableAnalyticsTracking);

    analytics.setCustomDimension(DIMENSION_PLATFORM, getAppPlatform());
    analytics.setCustomDimension(DIMENSION_VERSION, getAppVersion());

    if (accountId) {
      setAccountId(accountId);
    }

    analytics.pageView();
  }

  if (window && !isDevelopment()) {
    window.addEventListener('error', e => {
      trackEvent('Error', 'Uncaught Error');
      console.error('Uncaught Error', e);
    });

    window.addEventListener('unhandledRejection', e => {
      trackEvent('Error', 'Uncaught Promise');
      console.error('Unhandled Promise', e);
    });
  }
}

export function trackEvent (...args: Array<string>) {
  // Do on next tick in case it fails or blocks
  process.nextTick(() => {
    if (analytics) {
      analytics && analytics.trackEvent(true, ...args);
    }
  });
}

export function trackNonInteractiveEvent (...args: Array<string>) {
  // Do on next tick in case it fails or blocks
  process.nextTick(() => {
    if (analytics) {
      analytics && analytics.trackEvent(false, ...args);
    }
  });
}

export function setAccountId (accountId: string) {
  // Do on next tick in case it fails or blocks
  process.nextTick(() => {
    if (analytics) {
      analytics.setUserId(accountId);
    }
  });
}
