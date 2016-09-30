import Analytics from 'analytics-node';
import {getAppVersion} from './appInfo';
import * as db from './database';
import {SEGMENT_WRITE_KEY} from  './constants';

let analytics = null;
let userId = null;

export async function initAnalytics () {
  analytics = new Analytics(SEGMENT_WRITE_KEY);

  if (!userId) {
    const stats = await db.stats.get();
    userId = stats._id;

    // Recurse now that we have a userId
    return await initAnalytics();
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
}

export function trackEvent (event, properties = {}) {
  // Don't track events if we haven't set them up yet
  if (analytics) {
    // Add base properties
    Object.assign(properties, {
      appPlatform: process.platform,
      appVersion: getAppVersion()
    });

    analytics.track({userId, event, properties});
  }
}
