import * as segment from './segment';
import * as google from './google';

let initialized = false;
export function initAnalytics(accountId) {
  if (initialized) {
    return;
  }

  segment.init();
  google.init(accountId);

  initialized = true;
}

export function trackEvent (...args) {
  google.trackEvent(...args)
}

export function setAccountId (accountId) {
  google.setAccountId(accountId);
}

export function trackLegacyEvent (event, properties) {
  segment.trackLegacyEvent(event, properties)
}
