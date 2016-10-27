import * as constants from './constants';
import {isDevelopment} from './appInfo';

let _ga = null;
let _sessionId = null;

export function initAnalytics () {
  if (isDevelopment()) {
    console.log('-- Not initializing analytics for dev --');
    return;
  }

  if (!_sessionId) {
    _ga = _initGA();
  }

  if (!localStorage['gaClientId']) {
    localStorage.setItem('gaClientId', require('node-uuid').v4());
  }

  const _sessionId = window.localStorage['gaClientId'];

  _ga('create', constants.GA_ID, {'storage': 'none', 'clientId': _sessionId});

  // Disable URL protocol check
  _ga('set', 'checkProtocolTask', () => null);

  // Set a fake location
  _ga('set', 'location', `https://${constants.GA_HOST}/`);

  // Track the initial page view
  _ga('send', 'pageview');

  console.log(`-- Analytics Initialized for ${_sessionId} --`);
}

export function trackEvent (category, action, label) {
  _ga && _ga('send', 'event', category, action, label);
}

function _initGA () {
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
  })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

  return window.ga;
}
