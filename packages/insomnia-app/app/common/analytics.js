// @flow
import * as models from '../models/index';
import {buildQueryStringFromParams, joinUrlAndQueryString} from 'insomnia-url';
import * as electron from 'electron';
import uuid from 'uuid';
import {GA_ID, GA_LOCATION, getAppPlatform, getAppVersion, isDevelopment} from './constants';
import {getAccountId} from '../sync/session';
import type {RequestParameter} from '../models/request';
import {getScreenResolution, getUserLanguage, getViewportSize} from './misc';

const DIMENSION_PLATFORM = 1;
const DIMENSION_VERSION = 2;

const KEY_TRACKING_ID = 'tid';
const KEY_VERSION = 'v';
const KEY_CLIENT_ID = 'cid';
const KEY_USER_ID = 'uid';
const KEY_HIT_TYPE = 't';
const KEY_LOCATION = 'dl';
const KEY_TITLE = 'dt';
const KEY_NON_INTERACTION = 'ni';
const KEY_VIEWPORT_SIZE = 'vp';
const KEY_SCREEN_RESOLUTION = 'sr';
const KEY_USER_LANGUAGE = 'ul';
const KEY_DOCUMENT_ENCODING = 'de';
const KEY_EVENT_CATEGORY = 'ec';
const KEY_EVENT_ACTION = 'ea';
const KEY_EVENT_LABEL = 'el';
const KEY_EVENT_VALUE = 'ev';

const KEY_CUSTOM_DIMENSION_PREFIX = 'cd';

export function trackEvent (
  category: string,
  action: string,
  label: ?string,
  value: ?string
) {
  process.nextTick(async () => {
    await _trackEvent(true, category, action, label, value);
  });
}

export function trackNonInteractiveEvent (
  category: string,
  action: string,
  label: ?string,
  value: ?string
) {
  process.nextTick(async () => {
    await _trackEvent(false, category, action, label, value);
  });
}

export function trackPageView () {
  process.nextTick(async () => {
    await _trackPageView();
  });
}

// ~~~~~~~~~~~~~~~~~ //
// Private Functions //
// ~~~~~~~~~~~~~~~~~ //

// Exported for testing
export async function _trackEvent (
  interactive: boolean,
  category: string,
  action: string,
  label: ?string,
  value: ?string
) {
  const prefix = interactive ? '[ga] Event' : '[ga] Non-interactive';
  console.log(prefix, [category, action, label, value].filter(Boolean).join(', '));

  const params = [
    {name: KEY_HIT_TYPE, value: 'event'},
    {name: KEY_EVENT_CATEGORY, value: category},
    {name: KEY_EVENT_ACTION, value: action}
  ];

  !interactive && params.push({name: KEY_NON_INTERACTION, value: '1'});
  label && params.push({name: KEY_EVENT_LABEL, value: label});
  value && params.push({name: KEY_EVENT_VALUE, value: value});

  await _sendToGoogle(params);
}

async function _trackPageView () {
  const params = [{name: KEY_HIT_TYPE, value: 'pageview'}];
  console.log('[ga] Page', GA_LOCATION);
  await _sendToGoogle(params);
}

async function _getDefaultParams (): Promise<Array<RequestParameter>> {
  let settings = await models.settings.getOrCreate();
  const accountId = getAccountId();

  // Migrate old GA ID into settings model
  let {deviceId} = settings;
  if (!deviceId) {
    const oldId = (window && window.localStorage['gaClientId']) || null;
    deviceId = oldId || uuid.v4();
    await models.settings.update(settings, {deviceId});
  }

  const params = [
    {name: KEY_VERSION, value: '1'},
    {name: KEY_TRACKING_ID, value: GA_ID},
    {name: KEY_CLIENT_ID, value: deviceId},
    {name: KEY_LOCATION, value: GA_LOCATION},
    {name: KEY_SCREEN_RESOLUTION, value: getScreenResolution()},
    {name: KEY_USER_LANGUAGE, value: getUserLanguage()},
    {name: KEY_TITLE, value: `Insomnia ${getAppVersion()}`},
    {name: KEY_CUSTOM_DIMENSION_PREFIX + DIMENSION_PLATFORM, value: getAppPlatform()},
    {name: KEY_CUSTOM_DIMENSION_PREFIX + DIMENSION_VERSION, value: getAppVersion()}
  ];

  const viewport = getViewportSize();
  viewport && params.push({name: KEY_VIEWPORT_SIZE, value: viewport});

  accountId && params.push({name: KEY_USER_ID, value: accountId});
  global.document && params.push({
    name: KEY_DOCUMENT_ENCODING,
    value: global.document.inputEncoding
  });

  return params;
}

async function _sendToGoogle (params: Array<RequestParameter>) {
  let settings = await models.settings.getOrCreate();
  if (settings.disableAnalyticsTracking) {
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
    const {statusCode} = response;
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
        const {hitParsingResult} = data;
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
