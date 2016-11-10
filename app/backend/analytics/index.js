import * as segment from './segment';
import * as google from './google';

export function initAnalytics(accountId) {
  segment.init();
  google.init(accountId);
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
