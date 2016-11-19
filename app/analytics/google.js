import * as constants from '../common/constants';

let _sessionId = null;

export function init (userId = null) {
  if (constants.isDevelopment()) {
    console.log(`[ga] Not initializing for dev`);
    return;
  }

  if (!_sessionId) {
    _injectGoogleAnalyticsScript();
  }

  if (!window.localStorage['gaClientId']) {
    window.localStorage['gaClientId'] = require('uuid').v4();
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

  if (userId) {
    setUserId(userId);
  }

  console.log(`[ga] Initialized for ${_sessionId}`);
}

export function setUserId (userId) {
  window.ga && window.ga('set', 'userId', userId);
  console.log(`[ga] Set userId ${userId}`);
}

export function sendEvent (...googleAnalyticsArgs) {
  window.ga && window.ga('send', 'event', ...googleAnalyticsArgs);
  console.log(`[ga] Send event [${googleAnalyticsArgs.join(', ')}]`);
}

function _injectGoogleAnalyticsScript () {
  try {
    (function (i, s, o, g, r, a, m) {
      i['GoogleAnalyticsObject'] = r;
      i[r] = i[r] || function () {
          (i[r].q = i[r].q || []).push(arguments)
        }, i[r].l = 1 * new Date();
      a = s.createElement(o);
      m = s.getElementsByTagName(o)[0];
      a.async = 1;
      a.src = g;
      m.parentNode.insertBefore(a, m)
    })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
  } catch (e) {
    console.warn('[ga] Failed to inject Google Analytics')
  }
}
