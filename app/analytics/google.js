// @flow
import {getAppVersion, isDevelopment} from '../common/constants';
import * as electron from 'electron';
import * as querystring from '../common/querystring';
import type {RequestParameter} from '../models/request';

const KEY_TRACKING_ID = 'cid';
const KEY_VERSION = 'v';
const KEY_CLIENT_ID = 'cid';
const KEY_USER_ID = 'uid';
const KEY_HIT_TYPE = 't';
const KEY_LOCATION = 'dl';
const KEY_TITLE = 'dt';
// const KEY_VIEWPORT_SIZE = 'vp';
// const KEY_SCREEN_RESOLUTION = 'sr';
// const KEY_USER_LANGUAGE = 'ul';
// const KEY_DOCUMENT_ENCODING = 'de';
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
  _customDimensions: {[string]: string};
  _location: string;

  constructor (trackingId: string, clientId: string, location: string) {
    this._trackingId = trackingId;
    this._clientId = clientId;
    this._location = location;
    this._userId = null;
    this._customDimensions = {};
  }

  sendEvent (category: string, action: string, label: ?string, value: ?string) {
    const params = [
      {name: KEY_HIT_TYPE, value: 'event'},
      {name: KEY_EVENT_CATEGORY, value: category},
      {name: KEY_EVENT_ACTION, value: action}
    ];

    label && params.push({name: KEY_EVENT_LABEL, value: label});
    value && params.push({name: KEY_EVENT_VALUE, value: value});

    this._request(params);
  }

  sendPageView () {
    const params = [{name: KEY_HIT_TYPE, value: 'pageview'}];
    this._request(params);
  }

  setCustomDimension (index: number, value: string) {
    this._customDimensions[index.toString()] = value;
  }

  _getDefaultParams () {
    const params = [
      {name: KEY_VERSION, value: '1'},
      {name: KEY_TRACKING_ID, value: this._trackingId},
      {name: KEY_CLIENT_ID, value: this._clientId},
      {name: KEY_LOCATION, value: this._location},
      {name: KEY_TITLE, value: `Insomnia ${getAppVersion()}`}
    ];

    this._userId && params.push({name: KEY_USER_ID, value: this._userId});

    for (const id of Object.keys(this._customDimensions)) {
      const name = KEY_CUSTOM_DIMENSION_PREFIX + id;
      const value = this._customDimensions[id];
      params.push({name, value});
    }

    return params;
  }

  _request (params: Array<RequestParameter>) {
    const allParams = [...this._getDefaultParams(), ...params];
    console.log('SENDING', allParams);

    const qs = querystring.buildFromParams(allParams);
    const url = querystring.joinUrl(BASE_URL, qs);
    const net = (electron.remote || electron).net;
    const request = net.request(url);

    request.on('response', response => {
      if (response.status) {
        console.log('RESPONSE', response);
      }
    });
  }
}
