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
  google.trackEvent(...args);
  console.log(`[analytics] track ${args.join(', ')}`);
}

export function setAccountId (accountId) {
  google.setAccountId(accountId);
  console.log(`[analytics] account Id ${accountId}`);
}

export function trackLegacyEvent (event, properties) {
  segment.trackLegacyEvent(event, properties)
}
