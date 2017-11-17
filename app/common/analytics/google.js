// @flow
import {getAppVersion, isDevelopment} from '../constants';
import * as electron from 'electron';
import * as querystring from '../querystring';
import type {RequestParameter} from '../../models/request';

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

const BASE_URL = isDevelopment()
  ? 'https://www.google-analytics.com/debug/collect'
  : 'https://www.google-analytics.com/collect';

export class GoogleAnalytics {
  _trackingId: string;
  _clientId: string;
  _userId: string | null;
  _location: string;
  _disabled: boolean;
  _customDimensions: {[string]: string};

  constructor (trackingId: string, clientId: string, location: string, disabled: boolean = false) {
    this._trackingId = trackingId;
    this._clientId = clientId;
    this._location = location;
    this._userId = null;
    this._disabled = disabled;
    this._customDimensions = {};
  }

  trackEvent (
    interactive: boolean,
    category: string,
    action: string,
    label: ?string,
    value: ?string
  ) {
    console.debug('[ga] Event', [category, action, label, value].filter(Boolean).join(', '));

    const params = [
      {name: KEY_HIT_TYPE, value: 'event'},
      {name: KEY_EVENT_CATEGORY, value: category},
      {name: KEY_EVENT_ACTION, value: action}
    ];

    !interactive && params.push({name: KEY_NON_INTERACTION, value: '1'});
    label && params.push({name: KEY_EVENT_LABEL, value: label});
    value && params.push({name: KEY_EVENT_VALUE, value: value});

    this._request(params);
  }

  pageView () {
    const params = [{name: KEY_HIT_TYPE, value: 'pageview'}];
    console.debug('[ga] Page', this._location);
    this._request(params);
  }

  setCustomDimension (index: number, value: string) {
    this._customDimensions[index.toString()] = value;
  }

  setUserId (userId: string) {
    this._userId = userId;
  }

  _getViewportSize (): string | null {
    const {BrowserWindow} = electron.remote || electron;
    const w = BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows()[0];

    if (w) {
      const {width, height} = w.getContentBounds();
      return `${width}x${height}`;
    } else {
      // No windows open
      return null;
    }
  }

  _getScreenResolution (): string {
    const {screen} = electron.remote || electron;
    const {width, height} = screen.getPrimaryDisplay().workAreaSize;
    return `${width}x${height}`;
  }

  _getUserLanguage () {
    const {app} = electron.remote || electron;
    return app.getLocale();
  }

  _getDefaultParams () {
    const params = [
      {name: KEY_VERSION, value: '1'},
      {name: KEY_TRACKING_ID, value: this._trackingId},
      {name: KEY_CLIENT_ID, value: this._clientId},
      {name: KEY_LOCATION, value: this._location},
      {name: KEY_SCREEN_RESOLUTION, value: this._getScreenResolution()},
      {name: KEY_USER_LANGUAGE, value: this._getUserLanguage()},
      {name: KEY_TITLE, value: `Insomnia ${getAppVersion()}`}
    ];

    const viewport = this._getViewportSize();
    viewport && params.push({name: KEY_VIEWPORT_SIZE, value: viewport});

    this._userId && params.push({name: KEY_USER_ID, value: this._userId});
    global.document && params.push({
      name: KEY_DOCUMENT_ENCODING,
      value: global.document.inputEncoding
    });

    for (const id of Object.keys(this._customDimensions)) {
      const name = KEY_CUSTOM_DIMENSION_PREFIX + id;
      const value = this._customDimensions[id];
      params.push({name, value});
    }

    return params;
  }

  _request (params: Array<RequestParameter>) {
    if (this._disabled) {
      console.debug('[ga] Google analytics tracking disabled. Not sending');
      return;
    }

    const allParams = [...this._getDefaultParams(), ...params];
    const qs = querystring.buildFromParams(allParams);
    const url = querystring.joinUrl(BASE_URL, qs);
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

      response.on('end', () => {
        try {
          const jsonStr = Buffer.concat(chunks).toString('utf8');
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
}
