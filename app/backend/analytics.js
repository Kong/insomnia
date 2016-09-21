'use strict';

const Analytics = require('analytics-node');
const {getAppVersion} = require('./appInfo');
const db = require('./database');
const {SEGMENT_WRITE_KEY} = require('./constants');

let analytics = null;
let userId = null;

module.exports.initAnalytics = () => {
  return new Promise((resolve, reject) => {
    analytics = new Analytics(SEGMENT_WRITE_KEY);

    if (!userId) {
      return db.statsGet().then(stats => {
        userId = stats._id;

        // Recurse now that we have a userId
        return module.exports.initAnalytics();
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
};

module.exports.trackEvent = (event, properties = {}) => {
  // Don't track events if we haven't set them up yet
  if (analytics) {
    // Add base properties
    Object.assign(properties, {
      appPlatform: process.platform,
      appVersion: getAppVersion()
    });

    analytics.track({userId, event, properties});
  }
};
