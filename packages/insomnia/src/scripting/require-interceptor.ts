import ajv from 'ajv';
import chai from 'chai';
import * as cheerio from 'cheerio';
import cryptojs from 'crypto-js';
import * as csvParseSync from 'csv-parse/sync';
import esToolkit from 'es-toolkit/compat';
import moment from 'moment';
import tv4 from 'tv4';
import * as uuid from 'uuid';
import xml2js from 'xml2js';

import { Collection as CollectionModule } from '../../../insomnia-scripting-environment/src/objects';

const externalModules = new Map<string, object>([
  ['ajv', ajv],
  ['chai', chai],
  ['cheerio', cheerio],
  ['crypto-js', cryptojs],
  ['csv-parse/lib/sync', csvParseSync],
  ['lodash', esToolkit],
  ['moment', moment],
  ['tv4', tv4],
  ['uuid', uuid],
  ['xml2js', xml2js],
]);

// wraps `target` with a Proxy restricting access to dangerious methods within the accepted modules. 
const blockMethods = (target: object, blocked: string[], label: string): object =>
  new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && blocked.includes(prop)) {
        throw new Error(`${label}.${prop} is not available in sandbox scripts`);
      }
      const value = (t as any)[prop];
      return typeof value === 'function' ? value.bind(t) : value;
    },
  });

export const requireInterceptor = (moduleName: string): any => {
  if (moduleName === 'timers') {
    // Block setImmediate 
    return blockMethods(require('node:timers'), ['setImmediate'], 'timers');
  } else if (moduleName === 'buffer') {
    // Buffer.allocUnsafe / Buffer.allocUnsafeSlow (can return a buffer backed by uninitialized memory). 
    const bufferModule = require('node:buffer');
    return {
      ...bufferModule,
      Buffer: blockMethods(bufferModule.Buffer, ['allocUnsafe', 'allocUnsafeSlow'], 'Buffer'),
    };
  } else if (moduleName === 'util') {
    // Block util.inherits (can directly manipulate the prototype chain). 
    // Block util.debuglog (can write to stderr based on the NODE_DEBUG environment variable). 
    return blockMethods(require('node:util'), ['inherits', 'debuglog'], 'util');
    } else if (moduleName === 'lodash') {
    const mod = externalModules.get('lodash')!;
    // Block lodash.template (can compile strings in global scope).
    // Block lodash.runInContext (runs code in a new global context).
    return blockMethods(mod, ['template', 'runInContext'], 'lodash');
  } else if (
    [
      // node.js modules
      'path',
      'assert',
      'url',
      'punycode',
      'querystring',
      'string_decoder',
      'stream',
      'events',
      // follows should be npm modules
      // but they are moved to here to avoid introducing additional dependencies
    ].includes(moduleName)
  ) {
    return require(moduleName);
  } else if (['atob', 'btoa'].includes(moduleName)) {
    return moduleName === 'atob' ? atob : btoa;
  } else if (
    [
      // external modules (without lodash — handled above)
      'ajv',
      'chai',
      'cheerio',
      'crypto-js',
      'csv-parse/lib/sync',
      'moment',
      'tv4',
      'uuid',
      'xml2js',
    ].includes(moduleName)
  ) {
    const externalModule = externalModules.get(moduleName);
    if (!externalModule) {
      throw new Error(`no module is found for "${moduleName}"`);
    }
    return externalModule;
  } else if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
    return CollectionModule;
  }

  throw new Error(`no module is found for "${moduleName}"`);
};
