import Analytics from 'analytics-node';
import {getAppVersion} from './appInfo';
import * as db from '../database';
import {SEGMENT_WRITE_KEY} from './constants';

let analytics = null;
let userId = null;

export function initAnalytics () {
  return new Promise((resolve, reject) => {
    analytics = new Analytics(SEGMENT_WRITE_KEY);

    if (!userId) {
      return db.statsGet().then(stats => {
        userId = stats._id;

        // Recurse now that we have a userId
        return initAnalytics();
      }).then(resolve, reject);
    }

    analytics.identify({
      userId,
      traits: {
        appPlatform: process.platform,
        appVersion: getAppVersion(),

        // Reserved Traits
        createdAt: new Date()
      }
    });

    console.log(`-- Analytics Initialized for ${userId} --`);
    resolve();
  });
}

export function trackEvent (event, properties = {}) {
  // Don't track events if we haven't set them up yet
  if (analytics) {
    analytics.track({userId, event, properties});
  }
}
