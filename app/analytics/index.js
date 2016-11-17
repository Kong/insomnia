import * as segment from './segment';
import * as google from './google';

let initialized = false;
export async function init (accountId) {
  if (initialized) {
    return;
  }

  try {
    await segment.init();
    await google.init(accountId);

    initialized = true;
  } catch (e) {
    // Just to be extra safe
  }
}

export function trackEvent (...args) {
  try {
    google.sendEvent(...args);
  } catch (e) {
    // Just to be extra safe
  }
}

export function setAccountId (accountId) {
  try {
    google.setUserId(accountId);
  } catch (e) {
    // Just to be extra safe
  }
}

export function trackLegacyEvent (event, properties) {
  try {
    segment.trackLegacyEvent(event, properties)
  } catch (e) {
    // Just to be extra safe
  }
}
