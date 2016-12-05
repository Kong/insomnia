import * as constants from '../common/constants';

let _sessionId = null;

const DIMENSION_PLATFORM = 'dimension1';
const DIMENSION_VERSION = 'dimension2';

export function init (userId, platform, version) {
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

  setUserId(userId);
  setPlatform(platform);
  setVersion(version);

  // Track the initial page view
  window.ga('send', 'pageview');

  console.log(`[ga] Initialized for ${_sessionId}`);
}

export function setPlatform (platform) {
  if (!window.ga || !platform) {
    return;
  }

  ga('set', DIMENSION_PLATFORM, platform);
  console.log(`[ga] Set platform ${platform}`);
}

export function setVersion (version) {
  if (!window.ga || !version) {
    return;
  }

  ga('set', DIMENSION_VERSION, version);
  console.log(`[ga] Set version ${version}`);
}

export function setUserId (userId) {
  if (!window.ga || !userId) {
    return;
  }

  window.ga('set', 'userId', userId);
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
