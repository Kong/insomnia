import * as constants from '../common/constants';

let _sessionId = null;

export function init (accountId = null) {
  if (constants.isDevelopment()) {
    console.log('-- Not initializing analytics for dev --');
    return;
  }

  if (!_sessionId) {
    _injectGoogleAnalyticsScript();
  }

  if (!localStorage['gaClientId']) {
    localStorage.setItem('gaClientId', require('node-uuid').v4());
  }

  const _sessionId = window.localStorage['gaClientId'];

  window.ga('create', constants.GA_ID, {
    'storage': 'none',
    'clientId': _sessionId
  });

  // Disable URL protocol check
  window.ga('set', 'checkProtocolTask', () => null);

  // Set a fake location
  window.ga('set', 'location', `https://${constants.GA_HOST}/`);

  // Track the initial page view
  window.ga('send', 'pageview');

  if (accountId) {
    setAccountId(accountId);
  }

  console.log(`-- Analytics Initialized for ${_sessionId} --`);
}

export function setAccountId (accountId) {
  window.ga && window.ga('set', 'userId', accountId);
}

export function trackEvent (...googleAnalyticsArgs) {
  if (!window.ga) {
    return;
  }

  window.ga('send', 'event', ...googleAnalyticsArgs);
}

function _injectGoogleAnalyticsScript () {
  (function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments)
      }, i[r].l = 1 * new Date();
    a = s.createElement(o),
      m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m)
  })(window, document, 'script', 'https://www.google-analytics.com/segment.js', 'ga');
}
