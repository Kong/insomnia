import * as assert from 'assert';
import * as buffer from 'buffer/';
import { EventEmitter } from 'eventemitter3';
import * as path from 'path-browserify';
import * as punnycode from 'punycode/';
import queryString from 'query-string';
import * as stream from 'readable-stream';
import * as stringdecoder from 'string_decoder';
import * as util from 'util';
import * as uuid from 'uuid';

let urlModule = URL;
let timersModule = {
    // TODO: not all of latest APIs are supported
    // but they are good enough for compatibility
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    clearTimeout: clearTimeout,
    // setImmediate: setImmediate, // TODO: deprecated
    // clearImmediate: clearImmediate, // TODO: deprecated
};
let queryStringModule = {
    decode: queryString.parse,
    encode: queryString.stringify,
    // not supported, querystring.stringify() can be used
    // escape: queryString.escape,
    parse: queryString.parse,
    stringify: queryString.stringify,
    // not supported, querystring.parse() can be used
    // unescape: queryString.unescape,
};
let utilModule = {
    // deprecated APIs are kept temporarily for compatibility
    format: util.format,
    deprecate: util.deprecate,
    debuglog: util.debuglog,
    inspect: util.inspect,
    isArray: util.isArray,
    isBoolean: util.isBoolean,
    isNull: util.isNull,
    isNullOrUndefined: util.isNullOrUndefined,
    isNumber: util.isNumber,
    isString: util.isString,
    isSymbol: util.isSymbol,
    isUndefined: util.isUndefined,
    isRegExp: util.isRegExp,
    isObject: util.isObject,
    isDate: util.isDate,
    isError: util.isError,
    isFunction: util.isFunction,
    isPrimitive: util.isPrimitive,
    isBuffer: util.isBuffer,
    log: util.log,
    inherits: util.inherits,
};
let eventsModule = {
    EventEmitter,
};

export function setUrlModule(module: any) {
    urlModule = module;
}
export function setTimersModule(module: any) {
    timersModule = module;
}
export function setQueryString(module: any) {
    queryStringModule = module;
}
export function setUtilModule(module: any) {
    utilModule = module;
}
export function setEventsModule(module: any) {
    eventsModule = module;
}

const builtinModules = new Map<string, any>([
    ['uuid', uuid],
]);

const nodeModules = new Map<string, any>([
    ['buffer', buffer],
    ['url', urlModule],
    ['stream', stream],
    ['path', path],
    ['assert', assert],
    ['querystring', queryStringModule],
    ['timers', timersModule],
    ['string_decoder', stringdecoder],
    ['punnycode', punnycode],
    ['util', utilModule],
    ['events', eventsModule],
]);

export function require(moduleName: string) {
    if (builtinModules.has(moduleName)) {
        return builtinModules.get(moduleName);
    }

    if (nodeModules.has(moduleName)) {
        // invoke main.js
    }

    throw Error(`no module is found for "${moduleName}"`);
}
