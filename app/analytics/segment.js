import Analytics from 'analytics-node';
import {SEGMENT_WRITE_KEY, getAppVersion, isDevelopment} from  '../common/constants';
import * as models from '../backend/models';

let analytics = null;
let userId = null;

export async function init () {
  if (isDevelopment()) {
    console.log('-- Not initializing Legacy analytics in dev --');
    return;
  }

  analytics = new Analytics(SEGMENT_WRITE_KEY);

  if (!userId) {
    const stats = await models.stats.get();
    userId = stats._id;

    // Recurse now that we have a userId
    return await init();
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
