export function trackEvent (...args) {
  window.ga && window.ga('send', 'event', ...args);
}

export function setUserId (accountId) {
  window.ga && window.ga('set', 'userId', accountId);
}
