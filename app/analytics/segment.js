import Analytics from 'analytics-node';
import {SEGMENT_WRITE_KEY, getAppVersion, isDevelopment} from  '../common/constants';
import * as models from '../models';

let analytics = null;
let userId = null;

export async function init () {
  if (isDevelopment()) {
    console.log('[segment] Not initializing for dev');
    return;
  }

  analytics = new Analytics(SEGMENT_WRITE_KEY);

  const stats = await models.stats.get();
  userId = stats._id;

  analytics.identify({
    userId,
    traits: {
      appPlatform: process.platform,
      appVersion: getAppVersion(),

      // Reserved Traits
      createdAt: new Date()
    }
  });
}

export function trackLegacyEvent (event, properties = {}) {

  if (analytics) {
    Object.assign(properties, {
      appPlatform: process.platform,
      appVersion: getAppVersion()
    });

    analytics.track({userId, event, properties});
  }
}
