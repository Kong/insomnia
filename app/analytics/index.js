import * as segment from './segment';
import * as google from './google';

let initialized = false;
export function init (accountId) {
  if (initialized) {
    return;
  }

  segment.init();
  google.init(accountId);

  initialized = true;
}

export function trackEvent (...args) {
  google.sendEvent(...args);
  console.log(`[analytics] track ${args.join(', ')}`);
}

export function setAccountId (accountId) {
  google.setUserId(accountId);
  console.log(`[analytics] account Id ${accountId}`);
}

export function trackLegacyEvent (event, properties) {
  segment.trackLegacyEvent(event, properties)
}
