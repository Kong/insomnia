import ajv from 'ajv';
import chai from 'chai';
import * as cheerio from 'cheerio';
import cryptojs from 'crypto-js';
import * as csvParseSync from 'csv-parse/sync';
import { Collection as CollectionModule } from 'insomnia-sdk';
import lodash from 'lodash';
import moment from 'moment';
import tv4 from 'tv4';
import * as uuid from 'uuid';
import xml2js from 'xml2js';

const externalModules = new Map<string, object>([
  ['ajv', ajv],
  ['chai', chai],
  ['cheerio', cheerio],
  ['crypto-js', cryptojs],
  ['csv-parse/lib/sync', csvParseSync],
  ['lodash', lodash],
  ['moment', moment],
  ['tv4', tv4],
  ['uuid', uuid],
  ['xml2js', xml2js],
]);

export const requireInterceptor = (moduleName: string): any => {
  if (
    [
      // node.js modules
      'path',
      'assert',
      'buffer',
      'util',
      'url',
      'punycode',
      'querystring',
      'string_decoder',
      'stream',
      'timers',
      'events',
      // follows should be npm modules
      // but they are moved to here to avoid introducing additional dependencies
    ].includes(moduleName)
  ) {
    return require(moduleName);
  } else if (
    [
      'atob',
      'btoa',
    ].includes(moduleName)
  ) {
    return moduleName === 'atob' ? atob : btoa;
  } else if (
    [
      // external modules
      'ajv',
      'chai',
      'cheerio',
      'crypto-js',
      'csv-parse/lib/sync',
      'lodash',
      'moment',
      'tv4',
      'uuid',
      'xml2js',
    ].includes(moduleName)
  ) {
    const externalModule = externalModules.get(moduleName);
    if (!externalModule) {
      throw Error(`no module is found for "${moduleName}"`);
    }
    return externalModule;
  } else if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
    return CollectionModule;
  }

  throw Error(`no module is found for "${moduleName}"`);
};
