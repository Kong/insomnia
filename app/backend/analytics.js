import Analytics from 'analytics-node';
import {getAppVersion} from './appInfo';
import {SEGMENT_WRITE_KEY} from  './constants';
import {isDevelopment} from './appInfo';
import * as models from './models';

let analytics = null;
let userId = null;

export async function initLegacyAnalytics () {
  if (isDevelopment()) {
    console.log('-- Not initializing Legacy analytics in dev --');
    return;
  }

  analytics = new Analytics(SEGMENT_WRITE_KEY);

  if (!userId) {
    const stats = await models.stats.get();
    userId = stats._id;

    // Recurse now that we have a userId
    return await initLegacyAnalytics();
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

  console.log(`-- Legacy analytics Initialized for ${userId} --`);
}

export function trackLegacyEvent (event, properties = {}) {
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
