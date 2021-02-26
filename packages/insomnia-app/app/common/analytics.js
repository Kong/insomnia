// @flow
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import * as electron from 'electron';
import * as models from '../models/index';
import * as db from '../common/database';
import * as uuid from 'uuid';
import {
  getAppId,
  getAppName,
  getAppPlatform,
  getAppVersion,
  getGoogleAnalyticsId,
  getGoogleAnalyticsLocation,
  getSegmentWriteKey,
  isDevelopment,
} from './constants';
import type { RequestParameter } from '../models/request';
import { getScreenResolution, getUserLanguage, getViewportSize } from './misc';
import Analytics from 'analytics-node';
import { getAccountId } from '../account/session';

const DIMENSION_PLATFORM = 1;
const DIMENSION_VERSION = 2;

const KEY_TRACKING_ID = 'tid';
const KEY_VERSION = 'v';
const KEY_CLIENT_ID = 'cid';
const KEY_HIT_TYPE = 't';
const KEY_LOCATION = 'dl';
const KEY_TITLE = 'dt';
const KEY_NON_INTERACTION = 'ni';
const KEY_VIEWPORT_SIZE = 'vp';
const KEY_SCREEN_RESOLUTION = 'sr';
const KEY_USER_LANGUAGE = 'ul';
const KEY_USER_AGENT = 'ua';
const KEY_DOCUMENT_ENCODING = 'de';
const KEY_EVENT_CATEGORY = 'ec';
const KEY_EVENT_ACTION = 'ea';
const KEY_EVENT_LABEL = 'el';
const KEY_EVENT_VALUE = 'ev';
const KEY_ANONYMIZE_IP = 'aip';
const KEY_APPLICATION_NAME = 'an';
const KEY_APPLICATION_ID = 'aid';
const KEY_APPLICATION_VERSION = 'av';

const KEY_CUSTOM_DIMENSION_PREFIX = 'cd';

let _currentLocationPath = '/';

export function trackEvent(category: string, action: string, label: ?string, value: ?string) {
  process.nextTick(async () => {
    await _trackEvent(true, category, action, label, value);
  });
}

export function trackNonInteractiveEvent(
  category: string,
  action: string,
  label: ?string,
  value: ?string,
) {
  process.nextTick(async () => {
    await _trackEvent(false, category, action, label, value, false);
  });
}

/**
 * Tracks an analytics event but queues it for later if analytics are
 * currently disabled. Once analytics setting is enabled, any queued
 * events will be sent automatically.
 *
 * This should be used sparingly!
 *
 * @param category
 * @param action
 * @param label
 * @param value
 */
export function trackNonInteractiveEventQueueable(
  category: string,
  action: string,
  label: ?string,
  value: ?string,
) {
  process.nextTick(async () => {
    await _trackEvent(false, category, action, label, value, true);
  });
}

export function trackPageView(path: string) {
  process.nextTick(async () => {
    await _trackPageView(path);
  });
}

export async function getDeviceId(): Promise<string> {
  const settings = await models.settings.getOrCreate();

  let { deviceId } = settings;
  if (!deviceId) {
    // Migrate old GA ID into settings model if needed
    const oldId = (window && window.localStorage.getItem('gaClientId')) || null;
    deviceId = oldId || uuid.v4();

    await models.settings.update(settings, { deviceId });
  }

  return deviceId;
}

let segmentClient = null;

export async function trackSegmentEvent(event: String, properties?: Object) {
  try {
    if (!segmentClient) {
      segmentClient = new Analytics(getSegmentWriteKey(), {
        axiosConfig: {
          // This is needed to ensure that we use the NodeJS adapter in the render process
          ...(global?.require && { adapter: global.require('axios/lib/adapters/http') }),
        },
      });
    }

    const anonymousId = await getDeviceId();

    // TODO: This currently always returns an empty string in the main process
    // This is due to the session data being stored in localStorage
    const userId = getAccountId();

    segmentClient.track({
      anonymousId,
      userId,
      event,
      properties,
      context: {
        app: {
          name: getAppName(),
          version: getAppVersion(),
        },
        os: {
          name: _getOsName(),
          version: process.getSystemVersion(),
        },
      },
    });
  } catch (err) {
    console.warn('[analytics] Error sending segment event', err);
  }
}

// ~~~~~~~~~~~~~~~~~ //
// Private Functions //
// ~~~~~~~~~~~~~~~~~ //

function _getOsName(): string {
  const platform = getAppPlatform();
  switch (platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    default:
      return platform;
  }
}

// Exported for testing
export async function _trackEvent(
  interactive: boolean,
  category: string,
  action: string,
  label: ?string,
  value: ?string,
  queuable: ?boolean,
) {
  const prefix = interactive ? '[ga] Event' : '[ga] Non-interactive';
  console.log(prefix, [category, action, label, value].filter(Boolean).join(', '));

  const params = [
    { name: KEY_HIT_TYPE, value: 'event' },
    { name: KEY_EVENT_CATEGORY, value: category },
    { name: KEY_EVENT_ACTION, value: action },
  ];

  !interactive && params.push({ name: KEY_NON_INTERACTION, value: '1' });
  label && params.push({ name: KEY_EVENT_LABEL, value: label });
  value && params.push({ name: KEY_EVENT_VALUE, value: value });

  await _sendToGoogle(params, !!queuable);
}

export async function _trackPageView(location: string) {
  _currentLocationPath = location;
  console.log('[ga] Page', _currentLocationPath);

  const params = [{ name: KEY_HIT_TYPE, value: 'pageview' }];

  await _sendToGoogle(params, false);
}

async function _getDefaultParams(): Promise<Array<RequestParameter>> {
  const deviceId = await getDeviceId();

  // Prepping user agent string prior to sending to GA due to Electron base UA not being GA friendly.
  const ua = String(window?.navigator?.userAgent)
    .replace(new RegExp(`${getAppId()}\\/\\d+\\.\\d+\\.\\d+ `), '')
    .replace(/Electron\/\d+\.\d+\.\d+ /, '');

  const params = [
    { name: KEY_VERSION, value: '1' },
    { name: KEY_TRACKING_ID, value: getGoogleAnalyticsId() },
    { name: KEY_CLIENT_ID, value: deviceId },
    { name: KEY_USER_AGENT, value: ua },
    { name: KEY_LOCATION, value: getGoogleAnalyticsLocation() + _currentLocationPath },
    { name: KEY_SCREEN_RESOLUTION, value: getScreenResolution() },
    { name: KEY_USER_LANGUAGE, value: getUserLanguage() },
    { name: KEY_TITLE, value: `${getAppId()}:${getAppVersion()}` },
    { name: KEY_CUSTOM_DIMENSION_PREFIX + DIMENSION_PLATFORM, value: getAppPlatform() },
    { name: KEY_CUSTOM_DIMENSION_PREFIX + DIMENSION_VERSION, value: getAppVersion() },
    { name: KEY_ANONYMIZE_IP, value: '1' },
    { name: KEY_APPLICATION_NAME, value: getAppName() },
    { name: KEY_APPLICATION_ID, value: getAppId() },
    { name: KEY_APPLICATION_VERSION, value: getAppVersion() },
  ];

  const viewport = getViewportSize();
  viewport && params.push({ name: KEY_VIEWPORT_SIZE, value: viewport });

  global.document &&
    params.push({
      name: KEY_DOCUMENT_ENCODING,
      value: global.document.inputEncoding,
    });

  return params;
}

// Monitor database changes to see if analytics gets enabled. If analytics
// become enabled, flush any queued events.
db.onChange(async changes => {
  for (const change of changes) {
    const [event, doc] = change;
    if (doc.type === models.settings.type && event === 'update') {
      if (doc.enableAnalytics) {
        await _flushQueuedEvents();
      }
    }
  }
});

async function _sendToGoogle(params: Array<RequestParameter>, queueable: boolean) {
  const settings = await models.settings.getOrCreate();
  if (!settings.enableAnalytics) {
    if (queueable) {
      console.log('[ga] Queued event', params);
      _queuedEvents.push(params);
    }
    return;
  }

  const baseParams = await _getDefaultParams();
  const allParams = [...baseParams, ...params];
  const qs = buildQueryStringFromParams(allParams);
  const baseUrl = isDevelopment()
    ? 'https://www.google-analytics.com/debug/collect'
    : 'https://www.google-analytics.com/collect';
  const url = joinUrlAndQueryString(baseUrl, qs);

  const net = (electron.remote || electron).net;
  const request = net.request(url);

  request.once('error', err => {
    console.warn('[ga] Network error', err);
  });

  request.once('response', response => {
    const { statusCode } = response;
    if (statusCode < 200 && statusCode >= 300) {
      console.warn('[ga] Bad status code ' + statusCode);
    }

    const chunks = [];
    const [contentType] = response.headers['content-type'] || [];

    if (contentType !== 'application/json') {
      // Production GA API returns a Gif to use for tracking
      return;
    }

    response.on('end', () => {
      const jsonStr = Buffer.concat(chunks).toString('utf8');
      try {
        const data = JSON.parse(jsonStr);
        const { hitParsingResult } = data;
        if (hitParsingResult.valid) {
          return;
        }

        for (const result of hitParsingResult || []) {
          for (const msg of result.parserMessage || []) {
            console.warn(`[ga] Error ${msg.description}`);
          }
        }
      } catch (err) {
        console.warn('[ga] Failed to parse response', err);
      }
    });

    response.on('data', chunk => {
      chunks.push(chunk);
    });
  });

  request.end();
}

/**
 * Flush any analytics events that were built up when analytics
 * were disabled.
 * @returns {Promise<void>}
 * @private
 */
let _queuedEvents = [];

async function _flushQueuedEvents() {
  console.log(`[ga] Flushing ${_queuedEvents.length} queued events`);

  const tmp = [..._queuedEvents];

  // Clear queue before we even start sending to prevent races
  _queuedEvents = [];

  for (const params of tmp) {
    console.log('[ga] Flushing queued event', params);
    await _sendToGoogle(params, false);
  }
}
