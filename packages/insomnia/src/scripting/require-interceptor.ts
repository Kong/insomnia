import * as assert from 'node:assert';
import { Blob, Buffer, constants as bufferConstants, File, INSPECT_MAX_BYTES, isAscii, isUtf8, kMaxLength, kStringMaxLength, resolveObjectURL, SlowBuffer, transcode } from 'node:buffer';
import * as events from 'node:events';
import { addAbortListener, defaultMaxListeners, errorMonitor, EventEmitter, EventEmitterAsyncResource, getEventListeners, getMaxListeners, listenerCount, on as eventsOn, once as eventsOnce, setMaxListeners } from 'node:events';
import path from 'node:path';
import * as punycode from 'node:punycode';
import * as querystring from 'node:querystring';
import * as stream from 'node:stream';
import * as stringDecoder from 'node:string_decoder';
import * as timers from 'node:timers';
import * as url from 'node:url';
// eslint-disable-next-line unicorn/import-style
import * as util from 'node:util';

import ajv from 'ajv';
import chai from 'chai';
import * as cheerio from 'cheerio';
import cryptojs from 'crypto-js';
import * as csvParseSync from 'csv-parse/sync';
import { AbortError as esAbortError, assert as esAssert, asyncNoop as esAsyncNoop, attemptAsync as esAttemptAsync, constantCase as esConstantCase, filterAsync as esFilterAsync, flatMapAsync as esFlatMapAsync, flattenObject as esFlattenObject, forEachAsync as esForEachAsync, invariant as esInvariant, isBlob as esIsBlob, isBrowser as esIsBrowser, isEmptyObject as esIsEmptyObject, isFile as esIsFile, isJSON as esIsJSON, isJSONArray as esIsJSONArray, isJSONObject as esIsJSONObject, isJSONValue as esIsJSONValue, isNode as esIsNode, isNotNil as esIsNotNil, isPrimitive as esIsPrimitive, isPromise as esIsPromise, isSubset as esIsSubset, isSubsetWith as esIsSubsetWith, limitAsync as esLimitAsync, mapAsync as esMapAsync, median as esMedian, medianBy as esMedianBy, Mutex as esMutex, pascalCase as esPascalCase, randomInt as esRandomInt, reduceAsync as esReduceAsync, retry as esRetry, reverseString as esReverseString, Semaphore as esSemaphore, timeout as esTimeout, TimeoutError as esTimeoutError, toCamelCaseKeys as esToCamelCaseKeys, toFilled as estoFilled, toMerged as estoMerged, toSnakeCaseKeys as estoSnakeCaseKeys, windowed as esWindowed, withTimeout as esWithTimeout } from 'es-toolkit';
import esToolkit from 'es-toolkit/compat';
import moment from 'moment';
import tv4 from 'tv4';
import * as uuid from 'uuid';
import xml2js from 'xml2js';

import { Collection as CollectionModule } from '../../../insomnia-scripting-environment/src/objects';

// Node.js built-in: assert
const safeAssert = {
  Assert: assert.AssertionError,
  ok: (value: any, message?: string | Error) => assert.ok(value, message),
  equal: (actual: unknown, expected: unknown, message?: string | Error) => assert.equal(actual, expected, message),
  notEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.notEqual(actual, expected, message),
  deepEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.deepEqual(actual, expected, message),
  notDeepEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.notDeepEqual(actual, expected, message),
  strictEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.strictEqual(actual, expected, message),
  notStrictEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.notStrictEqual(actual, expected, message),
  deepStrictEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.deepStrictEqual(actual, expected, message),
  notDeepStrictEqual: (actual: unknown, expected: unknown, message?: string | Error) => assert.notDeepStrictEqual(actual, expected, message),
  throws: (fn: () => any, error?: any, message?: string | Error) => assert.throws(fn, error, message),
  doesNotThrow: (fn: () => any, error?: any, message?: string | Error) => assert.doesNotThrow(fn, error, message),
  rejects: (fn: () => Promise<any>, error?: any, message?: string | Error) => assert.rejects(fn, error, message),
  doesNotReject: (fn: () => Promise<any>, error?: any, message?: string | Error) => assert.doesNotReject(fn, error, message),
  ifError: (value: any) => assert.ifError(value),
  fail: (message?: string | Error) => assert.fail(message),
  match: (string: string, regexp: RegExp, message?: string | Error) => assert.match(string, regexp, message),
  doesNotMatch: (string: string, regexp: RegExp, message?: string | Error) => assert.doesNotMatch(string, regexp, message),
  AssertionError: function SafeAssertionError(options?: any) {
    return new assert.AssertionError(options);
  },
  CallTracker: function SafeCallTracker() {
    return new (assert as any).CallTracker();
  },
  partialDeepStrictEqual: (actual: unknown, expected: unknown, message?: string | Error) => (assert as any).partialDeepStrictEqual(actual, expected, message),
  strict: assert.strict as any,
};

// Node.js built-in: buffer
const safeBuffer = {
  from: (data: string | ArrayBuffer | SharedArrayBuffer | number[], encoding?: BufferEncoding) => Buffer.from(data as any, encoding),
  alloc: (size: number, fill?: string | Buffer | number, encoding?: BufferEncoding) => Buffer.alloc(size, fill as any, encoding),
  concat: (list: Uint8Array[], totalLength?: number) => Buffer.concat(list, totalLength),
  compare: (buf1: Uint8Array, buf2: Uint8Array) => Buffer.compare(buf1, buf2),
  isBuffer: (obj: any): boolean => Buffer.isBuffer(obj),
  byteLength: (string: string, encoding?: BufferEncoding): number => Buffer.byteLength(string, encoding),
  isEncoding: (encoding: string): boolean => Buffer.isEncoding(encoding),
  Blob: function SafeBlob(...args: any[]) {
    return new (Blob as any)(...args);
  },
  File: function SafeFile(...args: any[]) {
    return new (File as any)(...args);
  },
  INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
  constants: Object.freeze({
    MAX_LENGTH: bufferConstants.MAX_LENGTH,
    MAX_STRING_LENGTH: bufferConstants.MAX_STRING_LENGTH,
  }),
  isAscii: (input: any) => isAscii(input as any),
  isUtf8: (input: any) => isUtf8(input as any),
  kMaxLength: kMaxLength,
  kStringMaxLength: kStringMaxLength,
  transcode: (source: Uint8Array, fromEnc: any, toEnc: any) => transcode(source, fromEnc, toEnc),
  SlowBuffer: function SafeSlowBuffer(size: number) {
    return new (SlowBuffer as any)(size);
  },
  atob: (str: string) => (globalThis as any).atob(str),
  btoa: (str: string) => (globalThis as any).btoa(str),
  resolveObjectURL: (id: string) => resolveObjectURL(id),
  Buffer: Object.assign(
    function SafeBuffer(size: number, fill?: string | Buffer | number, encoding?: BufferEncoding) {
      return Buffer.alloc(size, fill as any, encoding);
    },
    {
      from: (data: string | ArrayBuffer | SharedArrayBuffer | number[], encoding?: BufferEncoding) => Buffer.from(data as any, encoding),
      alloc: (size: number, fill?: string | Buffer | number, encoding?: BufferEncoding) => Buffer.alloc(size, fill as any, encoding),
      concat: (list: Uint8Array[], totalLength?: number) => Buffer.concat(list, totalLength),
      compare: (buf1: Uint8Array, buf2: Uint8Array) => Buffer.compare(buf1, buf2),
      isBuffer: (obj: any): boolean => Buffer.isBuffer(obj),
      byteLength: (string: string, encoding?: BufferEncoding): number => Buffer.byteLength(string, encoding),
      isEncoding: (encoding: string): boolean => Buffer.isEncoding(encoding),
      allocUnsafe: () => { throw new Error('Buffer.allocUnsafe is not available in sandbox scripts'); },
      allocUnsafeSlow: () => { throw new Error('Buffer.allocUnsafeSlow is not available in sandbox scripts'); },
    }
  ),
  // unsafe: allocUnsafe, allocUnsafeSlow (return buffers with uninitialized memory, leaking prior heap contents)
} as any;

// Node.js built-in: events
const safeEvents = {
  EventEmitter: function SafeEventEmitter(...args: any[]) {
    // eslint-disable-next-line unicorn/prefer-event-target
    return new EventEmitter(...(args as any));
  },
  EventEmitterAsyncResource: function SafeEventEmitterAsyncResource(...args: any[]) {
    return new EventEmitterAsyncResource(...(args as any));
  },
  once: (emitter: any, eventName: string | symbol) => eventsOnce(emitter, eventName),
  on: (emitter: any, eventName: string | symbol) => eventsOn(emitter, eventName),
  addAbortListener: (signal: AbortSignal, listener: (event: Event) => void) => addAbortListener(signal, listener),
  defaultMaxListeners: defaultMaxListeners,
  errorMonitor: errorMonitor,
  getEventListeners: (emitter: any, eventName: string | symbol) => getEventListeners(emitter, eventName),
  getMaxListeners: (emitter: any) => getMaxListeners(emitter),
  listenerCount: (emitter: any, eventName: string | symbol) => listenerCount(emitter, eventName),
  setMaxListeners: (n?: number, ...eventTargets: any[]) => setMaxListeners(n, ...eventTargets),
  init: (events as any).init,
  usingDomains: (events as any).usingDomains,
  // unsafe: captureRejections, captureRejectionSymbol (modify global unhandled-rejection behavior for all EventEmitters)
};

// Node.js built-in: path
const safePath = {
  join: (...paths: string[]) => path.join(...paths),
  resolve: (...paths: string[]) => path.resolve(...paths),
  relative: (from: string, to: string) => path.relative(from, to),
  dirname: (p: string) => path.dirname(p),
  basename: (p: string, ext?: string) => path.basename(p, ext),
  extname: (p: string) => path.extname(p),
  normalize: (p: string) => path.normalize(p),
  isAbsolute: (p: string) => path.isAbsolute(p),
  parse: (p: string) => path.parse(p),
  format: (pathObject: path.ParsedPath) => path.format(pathObject),
  matchesGlob: (p: string, pattern: string) => (path as any).matchesGlob(p, pattern),
  toNamespacedPath: (p: string) => (path as any).toNamespacedPath(p),
  _makeLong: (p: string) => (path as any)._makeLong(p),
  sep: path.sep,
  delimiter: path.delimiter,
  posix: {
    join: (...paths: string[]) => path.posix.join(...paths),
    resolve: (...paths: string[]) => path.posix.resolve(...paths),
    relative: (from: string, to: string) => path.posix.relative(from, to),
    dirname: (p: string) => path.posix.dirname(p),
    basename: (p: string, ext?: string) => path.posix.basename(p, ext),
    extname: (p: string) => path.posix.extname(p),
    normalize: (p: string) => path.posix.normalize(p),
    isAbsolute: (p: string) => path.posix.isAbsolute(p),
    parse: (p: string) => path.posix.parse(p),
    format: (pathObject: path.ParsedPath) => path.posix.format(pathObject),
    matchesGlob: (p: string, pattern: string) => (path.posix as any).matchesGlob(p, pattern),
    toNamespacedPath: (p: string) => (path.posix as any).toNamespacedPath(p),
    _makeLong: (p: string) => (path.posix as any)._makeLong(p),
    sep: path.posix.sep,
    delimiter: path.posix.delimiter,
  },
  win32: {
    join: (...paths: string[]) => path.win32.join(...paths),
    resolve: (...paths: string[]) => path.win32.resolve(...paths),
    relative: (from: string, to: string) => path.win32.relative(from, to),
    dirname: (p: string) => path.win32.dirname(p),
    basename: (p: string, ext?: string) => path.win32.basename(p, ext),
    extname: (p: string) => path.win32.extname(p),
    normalize: (p: string) => path.win32.normalize(p),
    isAbsolute: (p: string) => path.win32.isAbsolute(p),
    parse: (p: string) => path.win32.parse(p),
    format: (pathObject: path.ParsedPath) => path.win32.format(pathObject),
    matchesGlob: (p: string, pattern: string) => (path.win32 as any).matchesGlob(p, pattern),
    toNamespacedPath: (p: string) => (path.win32 as any).toNamespacedPath(p),
    _makeLong: (p: string) => (path.win32 as any)._makeLong(p),
    sep: path.win32.sep,
    delimiter: path.win32.delimiter,
  },
} as any;

// Node.js built-in: punycode
const safePunycode = {
  encode: (str: string) => punycode.encode(str),
  decode: (str: string) => punycode.decode(str),
  toASCII: (domain: string) => punycode.toASCII(domain),
  toUnicode: (domain: string) => punycode.toUnicode(domain),
  version: (punycode as any).version,
  ucs2: {
    encode: (codePoints: number[]) => punycode.ucs2.encode(codePoints),
    decode: (str: string) => punycode.ucs2.decode(str),
  },
};

// Node.js built-in: querystring
const safeQuerystring = {
  stringify: (obj?: any, sep?: string, eq?: string) => querystring.stringify(obj, sep, eq),
  parse: (str: string, sep?: string, eq?: string) => querystring.parse(str, sep, eq),
  escape: (str: string) => querystring.escape(str),
  unescape: (str: string) => querystring.unescape(str),
  decode: (str: string, sep?: string, eq?: string) => (querystring as any).decode(str, sep, eq),
  encode: (obj?: any, sep?: string, eq?: string) => (querystring as any).encode(obj, sep, eq),
  unescapeBuffer: (str: string, decodeSpaces?: boolean) => (querystring as any).unescapeBuffer(str, decodeSpaces),
};

// Node.js built-in: stream
const safeStream = {
  Readable: function SafeReadable(...args: any[]) {
    return new stream.Readable(...(args as any));
  },
  Writable: function SafeWritable(...args: any[]) {
    return new stream.Writable(...(args as any));
  },
  Duplex: function SafeDuplex(...args: any[]) {
    return new stream.Duplex(...(args as any));
  },
  Transform: function SafeTransform(...args: any[]) {
    return new stream.Transform(...(args as any));
  },
  PassThrough: function SafePassThrough(...args: any[]) {
    return new stream.PassThrough(...(args as any));
  },
  pipeline: (...args: any[]) => (stream.pipeline as any)(...args),
  finished: (...args: any[]) => (stream.finished as any)(...args),
  Stream: function SafeStream(...args: any[]) {
    return new (stream as any).Stream(...args);
  },
  addAbortSignal: (signal: AbortSignal, stream: any) => (stream as any).addAbortSignal(signal, stream),
  compose: (...args: any[]) => (stream as any).compose(...args),
  destroy: (stream: any, error?: Error) => (stream as any).destroy(stream, error),
  duplexPair: (options?: any) => (stream as any).duplexPair(options),
  getDefaultHighWaterMark: (objectMode: boolean) => (stream as any).getDefaultHighWaterMark(objectMode),
  isDestroyed: (s: any) => (stream as any).isDestroyed(s),
  isDisturbed: (s: any) => (stream as any).isDisturbed(s),
  isErrored: (s: any) => (stream as any).isErrored(s),
  isReadable: (s: any) => (stream as any).isReadable(s),
  isWritable: (s: any) => (stream as any).isWritable(s),
  promises: Object.freeze({
    finished: (...args: any[]) => (stream.promises.finished as any)(...args),
    pipeline: (...args: any[]) => (stream.promises.pipeline as any)(...args),
  }),
  _isArrayBufferView: (obj: any) => (stream as any)._isArrayBufferView(obj),
  _isUint8Array: (obj: any) => (stream as any)._isUint8Array(obj),
  _uint8ArrayToBuffer: (chunk: any) => (stream as any)._uint8ArrayToBuffer(chunk),
  // unsafe: setDefaultHighWaterMark (modifies global default high water mark state)
};

// Node.js built-in: string_decoder
const safeStringDecoder = {
  StringDecoder: function SafeStringDecoder(...args: any[]) {
    return new stringDecoder.StringDecoder(...(args as any));
  },
};

// Node.js built-in: timers
const safeTimers = {
  setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
    timers.setTimeout(callback, delay, ...args),
  clearTimeout: (timeout?: NodeJS.Timeout) => timers.clearTimeout(timeout),
  setInterval: (callback: (...args: any[]) => void, interval?: number, ...args: any[]) =>
    timers.setInterval(callback, interval, ...args),
  clearInterval: (interval?: NodeJS.Timeout) => timers.clearInterval(interval),
  clearImmediate: (immediate?: NodeJS.Immediate) => timers.clearImmediate(immediate),
  promises: Object.freeze({
    setTimeout: (delay?: number, value?: any, options?: any) => (timers.promises as any).setTimeout(delay, value, options),
    setInterval: (delay?: number, value?: any, options?: any) => (timers.promises as any).setInterval(delay, value, options),
    // unsafe: promises.scheduler (bypasses ordered timer queue)
  }),
  // unsafe: setImmediate, promises.setImmediate (bypass ordered timer queue, can interfere with script control)
  // unsafe: queueMicrotask (unpolled microtask execution)
};

// Node.js built-in: url
const safeUrl = {
  URL: function SafeURL(input: string, base?: string | url.URL) {
    return new url.URL(input, base);
  },
  URLSearchParams: function SafeURLSearchParams(init?: string | Record<string, string> | Iterable<[string, string]>) {
    return new url.URLSearchParams(init as any);
  },
  URLPattern: function SafeURLPattern(...args: any[]) {
    return new (url as any).URLPattern(...args);
  },
  format: (urlObject: url.URL | url.URLFormatOptions) => url.format(urlObject as any),
  parse: (urlString: string, parseQueryString?: boolean, slashesDenoteHost?: boolean) =>
    url.parse(urlString, parseQueryString as any, slashesDenoteHost),
  resolve: (from: string, to: string) => url.resolve(from, to),
  domainToASCII: (domain: string) => url.domainToASCII(domain),
  domainToUnicode: (domain: string) => url.domainToUnicode(domain),
  Url: function SafeUrl() {
    return (url as any).Url ? new (url as any).Url() : {};
  },
  pathToFileURL: (path: string) => (url as any).pathToFileURL(path),
  fileURLToPath: (fileUrl: string | url.URL) => (url as any).fileURLToPath(fileUrl),
  fileURLToPathBuffer: (fileUrl: string | url.URL) => (url as any).fileURLToPathBuffer(fileUrl),
  resolveObject: (source: string | any, relative: string | any) => (url as any).resolveObject(source, relative),
  urlToHttpOptions: (myURL: url.URL) => (url as any).urlToHttpOptions(myURL),
};

// Node.js built-in: util
const safeUtilMethods = {
  // Safe: formats strings with placeholder substitution
  format: (template: string, ...param: any[]) => util.format(template, ...param),
  // Safe: returns string representation of object for debugging
  inspect: (object: any, options?: any) => util.inspect(object, options),
  // Safe: converts callback-based function to promise-based
  promisify: (original: (...args: any[]) => any) => util.promisify(original),
  // Safe: converts promise-based function to callback-based
  callbackify: (original: (...args: any[]) => Promise<any>) => util.callbackify(original),
  // Safe: deep strict equality comparison
  isDeepStrictEqual: (val1: any, val2: any) => util.isDeepStrictEqual(val1, val2),
  // Safe: TextEncoder for string to bytes conversion
  TextEncoder: function SafeTextEncoder() {
    return new util.TextEncoder();
  },
  // Safe: TextDecoder for bytes to string conversion
  TextDecoder: function SafeTextDecoder(encoding?: string, options?: any) {
    return new util.TextDecoder(encoding, options);
  },
  // Safe: MIME type utilities
  MIMEParams: function SafeMIMEParams() {
    return new (util as any).MIMEParams();
  },
  MIMEType: function SafeMIMEType(input: string) {
    return new (util as any).MIMEType(input);
  },
  // Safe: deprecation wrapper
  deprecate: (fn: any, msg: string, code?: string) => util.deprecate(fn, msg, code),
  // Safe: system error utilities
  getSystemErrorMap: () => util.getSystemErrorMap(),
  getSystemErrorMessage: (err: number) => util.getSystemErrorMessage(err),
  getSystemErrorName: (err: number) => util.getSystemErrorName(err),
  // Safe: formatting with options
  formatWithOptions: (inspectOptions: any, format: string, ...param: any[]) => util.formatWithOptions(inspectOptions, format, ...param),
  // Safe: diff comparison
  diff: (actual: any, expected: any) => util.diff(actual, expected),
  // Safe: utilities
  isArray: (obj: any) => util.isArray(obj),
  parseArgs: (config?: any) => util.parseArgs(config),
  parseEnv: (content: string) => util.parseEnv(content),
  stripVTControlCharacters: (str: string) => util.stripVTControlCharacters(str),
  styleText: (format: any, text: string, options?: any) => util.styleText(format, text, options),
  toUSVString: (str: any) => util.toUSVString(str),
  aborted: (resource: any, signal: AbortSignal) => util.aborted(resource, signal),
  transferableAbortController: () => util.transferableAbortController(),
  transferableAbortSignal: (signal: AbortSignal) => util.transferableAbortSignal(signal),
  // Safe: type checking utilities (predicates only, no execution)
  types: Object.freeze({
    isArrayBuffer: util.types.isArrayBuffer,
    isArrayBufferView: util.types.isArrayBufferView,
    isAsyncFunction: util.types.isAsyncFunction,
    isBigInt64Array: util.types.isBigInt64Array,
    isBigUint64Array: util.types.isBigUint64Array,
    isBooleanObject: util.types.isBooleanObject,
    isBoxedPrimitive: util.types.isBoxedPrimitive,
    isDataView: util.types.isDataView,
    isDate: util.types.isDate,
    isExternal: util.types.isExternal,
    isFloat32Array: util.types.isFloat32Array,
    isFloat64Array: util.types.isFloat64Array,
    isGeneratorFunction: util.types.isGeneratorFunction,
    isGeneratorObject: util.types.isGeneratorObject,
    isInt8Array: util.types.isInt8Array,
    isInt16Array: util.types.isInt16Array,
    isInt32Array: util.types.isInt32Array,
    isMap: util.types.isMap,
    isMapIterator: util.types.isMapIterator,
    isNumberObject: util.types.isNumberObject,
    isPromise: util.types.isPromise,
    isProxy: util.types.isProxy,
    isRegExp: util.types.isRegExp,
    isSet: util.types.isSet,
    isSetIterator: util.types.isSetIterator,
    isStringObject: util.types.isStringObject,
    isSymbolObject: util.types.isSymbolObject,
    isTypedArray: util.types.isTypedArray,
    isUint8Array: util.types.isUint8Array,
    isUint8ClampedArray: util.types.isUint8ClampedArray,
    isUint16Array: util.types.isUint16Array,
    isUint32Array: util.types.isUint32Array,
    isWeakMap: util.types.isWeakMap,
    isWeakSet: util.types.isWeakSet,
    isAnyArrayBuffer: (util.types as any).isAnyArrayBuffer,
    isArgumentsObject: (util.types as any).isArgumentsObject,
    isBigIntObject: (util.types as any).isBigIntObject,
    isCryptoKey: (util.types as any).isCryptoKey,
    isFloat16Array: (util.types as any).isFloat16Array,
    isKeyObject: (util.types as any).isKeyObject,
    isModuleNamespaceObject: (util.types as any).isModuleNamespaceObject,
    isNativeError: (util.types as any).isNativeError,
    isSharedArrayBuffer: (util.types as any).isSharedArrayBuffer,
  }),
  _errnoException: (...args: any[]) => (util as any)._errnoException(...args),
  _exceptionWithHostPort: (...args: any[]) => (util as any)._exceptionWithHostPort(...args),
  _extend: (target: any, source: any) => (util as any)._extend(target, source),
  convertProcessSignalToExitCode: (signal: string) => (util as any).convertProcessSignalToExitCode(signal),
  debug: (msg: string) => (util as any).debug(msg),
  // unsafe: inherits (modifies prototype chain)
  // unsafe: debuglog (environment-dependent debugging output)
  // unsafe: setTraceSigInt (modifies global SIGINT signal handling)
  // unsafe: getCallSites (exposes host-context function/this references via CallSite, enabling global scope access)
};
const safeUtil = new Proxy(safeUtilMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// ajv v8.17.1
const safeAjvInstanceMethods = {
  compile: (instance: any) => (schema: any) => instance.compile(schema),
  validate: (instance: any) => (schema: any, data: any) => instance.validate(schema, data),
  validateSchema: (instance: any) => (schema: any) => instance.validateSchema(schema),
  getSchema: (instance: any) => (keyRef: string) => instance.getSchema(keyRef),
};
const createSafeAjvInstance = (instance: any) => {
  return new Proxy(instance, {
    get(target, prop) {
      const method = (safeAjvInstanceMethods as any)[prop];
      if (method) {
        return method(target);
      }
      if (typeof prop === 'string') {
        throw new TypeError(`Ajv.${prop} is not available in sandbox scripts`);
      }
    },
  });
};
const safeAjv = new Proxy(ajv, {
  get(target, prop) {
    if (typeof prop === 'string' && prop === 'default') {
      return function(...args: any[]) {
        const instance = new (target as any)(...args);
        return createSafeAjvInstance(instance);
      };
    }
    return (target as any)[prop];
  },
});

// chai v4.5.0
const safeChaiMethods = {
  expect: (target: any) => chai.expect(target),
  assert: (value: any, message?: string) => chai.assert(value, message),
  should: () => chai.should(),
  Should: () => (chai as any).Should(),
  Assertion: function SafeAssertion(obj?: any, message?: string, ssfi?: any) {
    return new chai.Assertion(obj, message, ssfi);
  },
  AssertionError: function SafeChaiAssertionError(message?: string, props?: any, ssfi?: any) {
    return new chai.AssertionError(message || '', props, ssfi);
  },
  config: {
    deepEqual: (chai.config as any).deepEqual,
    includeStack: (chai.config as any).includeStack,
    proxyExcludedKeys: (chai.config as any).proxyExcludedKeys,
    showDiff: (chai.config as any).showDiff,
    truncateThreshold: (chai.config as any).truncateThreshold,
    useProxy: (chai.config as any).useProxy,
  },
  version: (chai as any).version,
  util: {
    addChainableMethod: (...args: any[]) => (chai.util.addChainableMethod as any)(...args),
    addLengthGuard: (...args: any[]) => (chai.util.addLengthGuard as any)(...args),
    addMethod: (...args: any[]) => (chai.util.addMethod as any)(...args),
    addProperty: (...args: any[]) => (chai.util.addProperty as any)(...args),
    checkError: (...args: any[]) => (chai.util as any).checkError(...args),
    compareByInspect: (...args: any[]) => (chai.util.compareByInspect as any)(...args),
    eql: (...args: any[]) => (chai.util.eql as any)(...args),
    expectTypes: (...args: any[]) => (chai.util.expectTypes as any)(...args),
    flag: (...args: any[]) => (chai.util.flag as any)(...args),
    getActual: (...args: any[]) => (chai.util.getActual as any)(...args),
    getMessage: (...args: any[]) => (chai.util.getMessage as any)(...args),
    getName: (fn: any) => (chai.util as any).getName(fn),
    getOperator: (...args: any[]) => (chai.util as any).getOperator(...args),
    getOwnEnumerableProperties: (target: any) => chai.util.getOwnEnumerableProperties(target),
    getOwnEnumerablePropertySymbols: (target: any) => chai.util.getOwnEnumerablePropertySymbols(target),
    getPathInfo: (...args: any[]) => (chai.util.getPathInfo as any)(...args),
    hasProperty: (...args: any[]) => (chai.util.hasProperty as any)(...args),
    inspect: (obj: any, showHidden?: boolean, depth?: number, colors?: boolean) => chai.util.inspect(obj, showHidden, depth, colors),
    isNaN: (value: any) => (chai.util as any).isNaN(value),
    isProxyEnabled: () => chai.util.isProxyEnabled(),
    objDisplay: (obj: any) => chai.util.objDisplay(obj),
    overwriteChainableMethod: (...args: any[]) => (chai.util.overwriteChainableMethod as any)(...args),
    overwriteMethod: (...args: any[]) => (chai.util.overwriteMethod as any)(...args),
    overwriteProperty: (...args: any[]) => (chai.util.overwriteProperty as any)(...args),
    proxify: (...args: any[]) => (chai.util.proxify as any)(...args),
    test: (...args: any[]) => (chai.util.test as any)(...args),
    transferFlags: (...args: any[]) => (chai.util.transferFlags as any)(...args),
    type: (value: any) => (chai.util as any).type(value),
  },
  // unsafe: use (registers plugins that can execute arbitrary code)
};
const safeChai = new Proxy(safeChaiMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// cheerio v1.2.0
const safeCheerioMethods = {
  load: (content: string | Buffer, options?: any, isDocument?: boolean) => cheerio.load(content, options, isDocument),
  contains: (container: any, contained: any) => cheerio.contains(container, contained),
  decodeStream: (...args: any[]) => (cheerio as any).decodeStream(...args),
  loadBuffer: (...args: any[]) => (cheerio as any).loadBuffer(...args),
  merge: (arr1: any, arr2: any) => (cheerio as any).merge(arr1, arr2),
  stringStream: (...args: any[]) => (cheerio as any).stringStream(...args),
  // unsafe: fromURL (makes outbound network requests from sandbox)
};
const safeCheerio = new Proxy(safeCheerioMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// crypto-js v4.2.0
const safeCryptoJsMethods = {
  // Hashing algorithms
  MD5: (message: any) => cryptojs.MD5(message),
  SHA1: (message: any) => cryptojs.SHA1(message),
  SHA256: (message: any) => cryptojs.SHA256(message),
  SHA224: (message: any) => cryptojs.SHA224(message),
  SHA512: (message: any) => cryptojs.SHA512(message),
  SHA384: (message: any) => cryptojs.SHA384(message),
  SHA3: (message: any) => cryptojs.SHA3(message),
  RIPEMD160: (message: any) => cryptojs.RIPEMD160(message),
  // HMAC algorithms
  HmacMD5: (message: any, key: any) => cryptojs.HmacMD5(message, key),
  HmacSHA1: (message: any, key: any) => cryptojs.HmacSHA1(message, key),
  HmacSHA256: (message: any, key: any) => cryptojs.HmacSHA256(message, key),
  HmacSHA224: (message: any, key: any) => cryptojs.HmacSHA224(message, key),
  HmacSHA512: (message: any, key: any) => cryptojs.HmacSHA512(message, key),
  HmacSHA384: (message: any, key: any) => cryptojs.HmacSHA384(message, key),
  HmacSHA3: (message: any, key: any) => cryptojs.HmacSHA3(message, key),
  HmacRIPEMD160: (message: any, key: any) => cryptojs.HmacRIPEMD160(message, key),
  // Key derivation
  PBKDF2: (password: any, salt: any, options?: any) => cryptojs.PBKDF2(password, salt, options),
  EvpKDF: (password: any, salt: any, options?: any) => cryptojs.EvpKDF(password, salt, options),
  // Ciphers (objects with encrypt/decrypt methods)
  AES: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.AES.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.AES.decrypt(ciphertext, key, options),
  },
  DES: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.DES.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.DES.decrypt(ciphertext, key, options),
  },
  TripleDES: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.TripleDES.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.TripleDES.decrypt(ciphertext, key, options),
  },
  RC4: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.RC4.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.RC4.decrypt(ciphertext, key, options),
  },
  RC4Drop: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.RC4Drop.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.RC4Drop.decrypt(ciphertext, key, options),
  },
  Rabbit: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.Rabbit.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.Rabbit.decrypt(ciphertext, key, options),
  },
  RabbitLegacy: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.RabbitLegacy.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.RabbitLegacy.decrypt(ciphertext, key, options),
  },
  Blowfish: {
    encrypt: (plaintext: any, key: any, options?: any) => cryptojs.Blowfish.encrypt(plaintext, key, options),
    decrypt: (ciphertext: any, key: any, options?: any) => cryptojs.Blowfish.decrypt(ciphertext, key, options),
  },
  // Encoding namespace
  enc: Object.freeze({
    Base64: (cryptojs.enc as any).Base64,
    Base64url: (cryptojs.enc as any).Base64url,
    Hex: (cryptojs.enc as any).Hex,
    Latin1: (cryptojs.enc as any).Latin1,
    Utf16: (cryptojs.enc as any).Utf16,
    Utf16BE: (cryptojs.enc as any).Utf16BE,
    Utf16LE: (cryptojs.enc as any).Utf16LE,
    Utf8: (cryptojs.enc as any).Utf8,
  }),
  // Padding namespace
  pad: Object.freeze({
    AnsiX923: (cryptojs.pad as any).AnsiX923,
    Iso10126: (cryptojs.pad as any).Iso10126,
    Iso97971: (cryptojs.pad as any).Iso97971,
    NoPadding: (cryptojs.pad as any).NoPadding,
    Pkcs7: (cryptojs.pad as any).Pkcs7,
    ZeroPadding: (cryptojs.pad as any).ZeroPadding,
  }),
  // Mode namespace
  mode: Object.freeze({
    CBC: (cryptojs.mode as any).CBC,
    CFB: (cryptojs.mode as any).CFB,
    CTR: (cryptojs.mode as any).CTR,
    CTRGladman: (cryptojs.mode as any).CTRGladman,
    ECB: (cryptojs.mode as any).ECB,
    OFB: (cryptojs.mode as any).OFB,
  }),
  // Format namespace
  format: Object.freeze({
    Hex: (cryptojs.format as any).Hex,
    OpenSSL: (cryptojs.format as any).OpenSSL,
  }),
  // Lib namespace
  lib: Object.freeze({
    Base: (cryptojs.lib as any).Base,
    BlockCipher: (cryptojs.lib as any).BlockCipher,
    BlockCipherMode: (cryptojs.lib as any).BlockCipherMode,
    BufferedBlockAlgorithm: (cryptojs.lib as any).BufferedBlockAlgorithm,
    Cipher: (cryptojs.lib as any).Cipher,
    CipherParams: (cryptojs.lib as any).CipherParams,
    Hasher: (cryptojs.lib as any).Hasher,
    PasswordBasedCipher: (cryptojs.lib as any).PasswordBasedCipher,
    SerializableCipher: (cryptojs.lib as any).SerializableCipher,
    StreamCipher: (cryptojs.lib as any).StreamCipher,
    WordArray: (cryptojs.lib as any).WordArray,
  }),
  // Algorithm namespace
  algo: Object.freeze({
    AES: (cryptojs.algo as any).AES,
    Blowfish: (cryptojs.algo as any).Blowfish,
    DES: (cryptojs.algo as any).DES,
    EvpKDF: (cryptojs.algo as any).EvpKDF,
    HMAC: (cryptojs.algo as any).HMAC,
    MD5: (cryptojs.algo as any).MD5,
    PBKDF2: (cryptojs.algo as any).PBKDF2,
    RC4: (cryptojs.algo as any).RC4,
    RC4Drop: (cryptojs.algo as any).RC4Drop,
    RIPEMD160: (cryptojs.algo as any).RIPEMD160,
    Rabbit: (cryptojs.algo as any).Rabbit,
    RabbitLegacy: (cryptojs.algo as any).RabbitLegacy,
    SHA1: (cryptojs.algo as any).SHA1,
    SHA224: (cryptojs.algo as any).SHA224,
    SHA256: (cryptojs.algo as any).SHA256,
    SHA3: (cryptojs.algo as any).SHA3,
    SHA384: (cryptojs.algo as any).SHA384,
    SHA512: (cryptojs.algo as any).SHA512,
    TripleDES: (cryptojs.algo as any).TripleDES,
  }),
  // KDF namespace
  kdf: Object.freeze({
    OpenSSL: (cryptojs.kdf as any).OpenSSL,
  }),
  // 64-bit support namespace
  x64: Object.freeze({
    Word: (cryptojs.x64 as any).Word,
    WordArray: (cryptojs.x64 as any).WordArray,
  }),
};
const safeCryptoJs = new Proxy(safeCryptoJsMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// csv-parse v5.6.0
const safeCsvParseMethods = {
  parse: (input: string | Buffer, options?: any) => csvParseSync.parse(input, options),
  CsvError: function SafeCsvError(...args: any[]) {
    return new (csvParseSync as any).CsvError(...args);
  },
};
const safeCsvParse = new Proxy(safeCsvParseMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// es-toolkit v1.45.1 (lodash replacement)
const safeLodashMethods = {
  AbortError: esAbortError,
  Mutex: esMutex,
  Semaphore: esSemaphore,
  TimeoutError: esTimeoutError,
  after: (...args: any[]) => (esToolkit.after as any)(...args),
  ary: (...args: any[]) => (esToolkit.ary as any)(...args),
  assert: (...args: any[]) => (esAssert as any)(...args),
  asyncNoop: esAsyncNoop,
  at: (...args: any[]) => (esToolkit.at as any)(...args),
  attempt: (...args: any[]) => (esToolkit.attempt as any)(...args),
  attemptAsync: (...args: any[]) => (esAttemptAsync as any)(...args),
  before: (...args: any[]) => (esToolkit.before as any)(...args),
  camelCase: (str: string) => esToolkit.camelCase(str),
  capitalize: (str: string) => esToolkit.capitalize(str),
  chunk: (...args: any[]) => (esToolkit.chunk as any)(...args),
  clamp: (...args: any[]) => (esToolkit.clamp as any)(...args),
  clone: <T>(value: T) => esToolkit.clone(value),
  cloneDeep: <T>(value: T) => esToolkit.cloneDeep(value),
  cloneDeepWith: (...args: any[]) => (esToolkit.cloneDeepWith as any)(...args),
  compact: <T>(arr: T[]) => esToolkit.compact(arr),
  constantCase: (str: string) => esConstantCase(str),
  countBy: (...args: any[]) => (esToolkit.countBy as any)(...args),
  curry: (...args: any[]) => (esToolkit.curry as any)(...args),
  curryRight: (...args: any[]) => (esToolkit.curryRight as any)(...args),
  debounce: (...args: any[]) => (esToolkit.debounce as any)(...args),
  deburr: (str: string) => esToolkit.deburr(str),
  delay: (...args: any[]) => (esToolkit.delay as any)(...args),
  difference: (...args: any[]) => (esToolkit.difference as any)(...args),
  differenceBy: (...args: any[]) => (esToolkit.differenceBy as any)(...args),
  differenceWith: (...args: any[]) => (esToolkit.differenceWith as any)(...args),
  drop: (...args: any[]) => (esToolkit.drop as any)(...args),
  dropRight: (...args: any[]) => (esToolkit.dropRight as any)(...args),
  dropRightWhile: (...args: any[]) => (esToolkit.dropRightWhile as any)(...args),
  dropWhile: (...args: any[]) => (esToolkit.dropWhile as any)(...args),
  escape: (str: string) => esToolkit.escape(str),
  escapeRegExp: (str: string) => esToolkit.escapeRegExp(str),
  fill: (...args: any[]) => (esToolkit.fill as any)(...args),
  filterAsync: (...args: any[]) => (esFilterAsync as any)(...args),
  findKey: (...args: any[]) => (esToolkit.findKey as any)(...args),
  flatMap: (...args: any[]) => (esToolkit.flatMap as any)(...args),
  flatMapAsync: (...args: any[]) => (esFlatMapAsync as any)(...args),
  flatMapDeep: (...args: any[]) => (esToolkit.flatMapDeep as any)(...args),
  flatten: <T>(arr: T[][]) => esToolkit.flatten(arr),
  flattenDeep: (arr: any[]) => esToolkit.flattenDeep(arr),
  flattenObject: (...args: any[]) => (esFlattenObject as any)(...args),
  flow: (...args: any[]) => (esToolkit.flow as any)(...args),
  flowRight: (...args: any[]) => (esToolkit.flowRight as any)(...args),
  forEachAsync: (...args: any[]) => (esForEachAsync as any)(...args),
  forEachRight: (...args: any[]) => (esToolkit.forEachRight as any)(...args),
  groupBy: (...args: any[]) => (esToolkit.groupBy as any)(...args),
  head: <T>(arr: T[]) => esToolkit.head(arr),
  identity: <T>(value: T) => esToolkit.identity(value),
  inRange: (...args: any[]) => (esToolkit.inRange as any)(...args),
  initial: <T>(arr: T[]) => esToolkit.initial(arr),
  intersection: (...args: any[]) => (esToolkit.intersection as any)(...args),
  intersectionBy: (...args: any[]) => (esToolkit.intersectionBy as any)(...args),
  intersectionWith: (...args: any[]) => (esToolkit.intersectionWith as any)(...args),
  invariant: (...args: any[]) => (esInvariant as any)(...args),
  invert: (...args: any[]) => (esToolkit.invert as any)(...args),
  isArrayBuffer: (value: any) => esToolkit.isArrayBuffer(value),
  isBlob: (value: any) => esIsBlob(value),
  isBoolean: (value: any) => esToolkit.isBoolean(value),
  isBrowser: esIsBrowser,
  isBuffer: (value: any) => esToolkit.isBuffer(value),
  isDate: (value: any) => esToolkit.isDate(value),
  isEmptyObject: (value: any) => esIsEmptyObject(value),
  isEqual: (a: any, b: any) => esToolkit.isEqual(a, b),
  isEqualWith: (...args: any[]) => (esToolkit.isEqualWith as any)(...args),
  isError: (value: any) => esToolkit.isError(value),
  isFile: (value: any) => esIsFile(value),
  isFunction: (value: any) => esToolkit.isFunction(value),
  isJSON: (value: any) => esIsJSON(value),
  isJSONArray: (value: any) => esIsJSONArray(value),
  isJSONObject: (value: any) => esIsJSONObject(value),
  isJSONValue: (value: any) => esIsJSONValue(value),
  isLength: (value: any) => esToolkit.isLength(value),
  isMap: (value: any) => esToolkit.isMap(value),
  isNil: (value: any) => esToolkit.isNil(value),
  isNode: esIsNode,
  isNotNil: (value: any) => esIsNotNil(value),
  isNull: (value: any) => esToolkit.isNull(value),
  isNumber: (value: any) => esToolkit.isNumber(value),
  isPlainObject: (value: any) => esToolkit.isPlainObject(value),
  isPrimitive: (value: any) => esIsPrimitive(value),
  isPromise: (value: any) => esIsPromise(value),
  isRegExp: (value: any) => esToolkit.isRegExp(value),
  isSet: (value: any) => esToolkit.isSet(value),
  isString: (value: any) => esToolkit.isString(value),
  isSubset: (...args: any[]) => (esIsSubset as any)(...args),
  isSubsetWith: (...args: any[]) => (esIsSubsetWith as any)(...args),
  isSymbol: (value: any) => esToolkit.isSymbol(value),
  isTypedArray: (value: any) => esToolkit.isTypedArray(value),
  isUndefined: (value: any) => esToolkit.isUndefined(value),
  isWeakMap: (value: any) => esToolkit.isWeakMap(value),
  isWeakSet: (value: any) => esToolkit.isWeakSet(value),
  kebabCase: (str: string) => esToolkit.kebabCase(str),
  keyBy: (...args: any[]) => (esToolkit.keyBy as any)(...args),
  last: <T>(arr: T[]) => esToolkit.last(arr),
  limitAsync: (...args: any[]) => (esLimitAsync as any)(...args),
  lowerCase: (str: string) => esToolkit.lowerCase(str),
  lowerFirst: (str: string) => esToolkit.lowerFirst(str),
  mapAsync: (...args: any[]) => (esMapAsync as any)(...args),
  mapKeys: (...args: any[]) => (esToolkit.mapKeys as any)(...args),
  mapValues: (...args: any[]) => (esToolkit.mapValues as any)(...args),
  maxBy: (...args: any[]) => (esToolkit.maxBy as any)(...args),
  mean: (arr: number[]) => esToolkit.mean(arr),
  meanBy: (...args: any[]) => (esToolkit.meanBy as any)(...args),
  median: (arr: number[]) => esMedian(arr),
  medianBy: (...args: any[]) => (esMedianBy as any)(...args),
  memoize: (...args: any[]) => (esToolkit.memoize as any)(...args),
  merge: (...args: any[]) => (esToolkit.merge as any)(...args),
  mergeWith: (...args: any[]) => (esToolkit.mergeWith as any)(...args),
  minBy: (...args: any[]) => (esToolkit.minBy as any)(...args),
  negate: (...args: any[]) => (esToolkit.negate as any)(...args),
  noop: esToolkit.noop,
  omit: (...args: any[]) => (esToolkit.omit as any)(...args),
  omitBy: (...args: any[]) => (esToolkit.omitBy as any)(...args),
  once: (...args: any[]) => (esToolkit.once as any)(...args),
  orderBy: (...args: any[]) => (esToolkit.orderBy as any)(...args),
  pad: (...args: any[]) => (esToolkit.pad as any)(...args),
  partial: (...args: any[]) => (esToolkit.partial as any)(...args),
  partialRight: (...args: any[]) => (esToolkit.partialRight as any)(...args),
  partition: (...args: any[]) => (esToolkit.partition as any)(...args),
  pascalCase: (str: string) => esPascalCase(str),
  pick: (...args: any[]) => (esToolkit.pick as any)(...args),
  pickBy: (...args: any[]) => (esToolkit.pickBy as any)(...args),
  pull: (...args: any[]) => (esToolkit.pull as any)(...args),
  pullAt: (...args: any[]) => (esToolkit.pullAt as any)(...args),
  random: (...args: any[]) => (esToolkit.random as any)(...args),
  randomInt: (...args: any[]) => (esRandomInt as any)(...args),
  range: (...args: any[]) => (esToolkit.range as any)(...args),
  rangeRight: (...args: any[]) => (esToolkit.rangeRight as any)(...args),
  reduceAsync: (...args: any[]) => (esReduceAsync as any)(...args),
  remove: (...args: any[]) => (esToolkit.remove as any)(...args),
  rest: (...args: any[]) => (esToolkit.rest as any)(...args),
  retry: (...args: any[]) => (esRetry as any)(...args),
  reverseString: (str: string) => esReverseString(str),
  round: (...args: any[]) => (esToolkit.round as any)(...args),
  sample: <T>(arr: T[]) => esToolkit.sample(arr),
  sampleSize: (...args: any[]) => (esToolkit.sampleSize as any)(...args),
  shuffle: <T>(arr: T[]) => esToolkit.shuffle(arr),
  snakeCase: (str: string) => esToolkit.snakeCase(str),
  sortBy: (...args: any[]) => (esToolkit.sortBy as any)(...args),
  spread: (...args: any[]) => (esToolkit.spread as any)(...args),
  startCase: (str: string) => esToolkit.startCase(str),
  sum: (arr: number[]) => esToolkit.sum(arr),
  sumBy: (...args: any[]) => (esToolkit.sumBy as any)(...args),
  tail: <T>(arr: T[]) => esToolkit.tail(arr),
  take: (...args: any[]) => (esToolkit.take as any)(...args),
  takeRight: (...args: any[]) => (esToolkit.takeRight as any)(...args),
  takeRightWhile: (...args: any[]) => (esToolkit.takeRightWhile as any)(...args),
  takeWhile: (...args: any[]) => (esToolkit.takeWhile as any)(...args),
  throttle: (...args: any[]) => (esToolkit.throttle as any)(...args),
  timeout: (...args: any[]) => (esTimeout as any)(...args),
  toCamelCaseKeys: (...args: any[]) => (esToCamelCaseKeys as any)(...args),
  toFilled: (...args: any[]) => (estoFilled as any)(...args),
  toMerged: (...args: any[]) => (estoMerged as any)(...args),
  toSnakeCaseKeys: (...args: any[]) => (estoSnakeCaseKeys as any)(...args),
  trim: (...args: any[]) => (esToolkit.trim as any)(...args),
  trimEnd: (...args: any[]) => (esToolkit.trimEnd as any)(...args),
  trimStart: (...args: any[]) => (esToolkit.trimStart as any)(...args),
  unary: (...args: any[]) => (esToolkit.unary as any)(...args),
  unescape: (str: string) => esToolkit.unescape(str),
  union: (...args: any[]) => (esToolkit.union as any)(...args),
  unionBy: (...args: any[]) => (esToolkit.unionBy as any)(...args),
  unionWith: (...args: any[]) => (esToolkit.unionWith as any)(...args),
  uniq: <T>(arr: T[]) => esToolkit.uniq(arr),
  uniqBy: (...args: any[]) => (esToolkit.uniqBy as any)(...args),
  uniqWith: (...args: any[]) => (esToolkit.uniqWith as any)(...args),
  unzip: (...args: any[]) => (esToolkit.unzip as any)(...args),
  unzipWith: (...args: any[]) => (esToolkit.unzipWith as any)(...args),
  upperCase: (str: string) => esToolkit.upperCase(str),
  upperFirst: (str: string) => esToolkit.upperFirst(str),
  windowed: (...args: any[]) => (esWindowed as any)(...args),
  withTimeout: (...args: any[]) => (esWithTimeout as any)(...args),
  without: (...args: any[]) => (esToolkit.without as any)(...args),
  words: (...args: any[]) => (esToolkit.words as any)(...args),
  xor: (...args: any[]) => (esToolkit.xor as any)(...args),
  xorBy: (...args: any[]) => (esToolkit.xorBy as any)(...args),
  xorWith: (...args: any[]) => (esToolkit.xorWith as any)(...args),
  zip: (...args: any[]) => (esToolkit.zip as any)(...args),
  zipObject: (...args: any[]) => (esToolkit.zipObject as any)(...args),
  zipWith: (...args: any[]) => (esToolkit.zipWith as any)(...args),
  // unsafe: template (compiles strings as template code)
  // unsafe: runInContext (creates new global context for code execution)
};

const safeLodash = new Proxy(safeLodashMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// moment v2.30.1
const safeMomentMethods = {
  utc: (...args: any[]) => (moment.utc as any)(...args),
  unix: (...args: any[]) => (moment.unix as any)(...args),
  duration: (...args: any[]) => (moment.duration as any)(...args),
  isDuration: (obj: any) => moment.isDuration(obj),
  isMoment: (obj: any) => moment.isMoment(obj),
  isDate: (obj: any) => moment.isDate(obj),
  invalid: (flags?: any) => moment.invalid(flags),
  locale: (...args: any[]) => (moment.locale as any)(...args),
  locales: () => moment.locales(),
  months: (...args: any[]) => (moment.months as any)(...args),
  monthsShort: (...args: any[]) => (moment.monthsShort as any)(...args),
  weekdays: (...args: any[]) => (moment.weekdays as any)(...args),
  weekdaysShort: (...args: any[]) => (moment.weekdaysShort as any)(...args),
  weekdaysMin: (...args: any[]) => (moment.weekdaysMin as any)(...args),
  now: () => moment.now(),
  max: (...args: any[]) => (moment.max as any)(...args),
  min: (...args: any[]) => (moment.min as any)(...args),
  defineLocale: (...args: any[]) => (moment.defineLocale as any)(...args),
  updateLocale: (...args: any[]) => (moment.updateLocale as any)(...args),
  normalizeUnits: (...args: any[]) => (moment.normalizeUnits as any)(...args),
  relativeTimeThreshold: (...args: any[]) => (moment.relativeTimeThreshold as any)(...args),
  relativeTimeRounding: (...args: any[]) => (moment.relativeTimeRounding as any)(...args),
  ISO_8601: moment.ISO_8601,
  RFC_2822: moment.RFC_2822,
  HTML5_FMT: Object.freeze({
    DATETIME_LOCAL: (moment as any).HTML5_FMT.DATETIME_LOCAL,
    DATETIME_LOCAL_SECONDS: (moment as any).HTML5_FMT.DATETIME_LOCAL_SECONDS,
    DATETIME_LOCAL_MS: (moment as any).HTML5_FMT.DATETIME_LOCAL_MS,
    DATE: (moment as any).HTML5_FMT.DATE,
    TIME: (moment as any).HTML5_FMT.TIME,
    TIME_SECONDS: (moment as any).HTML5_FMT.TIME_SECONDS,
    TIME_MS: (moment as any).HTML5_FMT.TIME_MS,
    WEEK: (moment as any).HTML5_FMT.WEEK,
    MONTH: (moment as any).HTML5_FMT.MONTH,
  }),
  // unsafe: fn (exposes moment.prototype, enabling prototype pollution across all moment instances)
  version: (moment as any).version,
  calendarFormat: (...args: any[]) => (moment as any).calendarFormat(...args),
  createFromInputFallback: (moment as any).createFromInputFallback,
  defaultFormat: (moment as any).defaultFormat,
  defaultFormatUtc: (moment as any).defaultFormatUtc,
  deprecationHandler: (moment as any).deprecationHandler,
  lang: (...args: any[]) => (moment as any).lang(...args),
  langData: (...args: any[]) => (moment as any).langData(...args),
  localeData: (...args: any[]) => (moment.localeData as any)(...args),
  momentProperties: (moment as any).momentProperties,
  parseTwoDigitYear: (year: string) => (moment as any).parseTwoDigitYear(year),
  parseZone: (...args: any[]) => (moment.parseZone as any)(...args),
  suppressDeprecationWarnings: (moment as any).suppressDeprecationWarnings,
  updateOffset: (moment as any).updateOffset,
};
const safeMoment = new Proxy(safeMomentMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// tv4 v1.3.0
const safeTv4Methods = {
  validate: (...args: any[]) => (tv4.validate as any)(...args),
  validateMultiple: (...args: any[]) => (tv4.validateMultiple as any)(...args),
  validateResult: (...args: any[]) => (tv4.validateResult as any)(...args),
  getSchema: (uri: string) => tv4.getSchema(uri),
  getMissingUris: (...args: any[]) => (tv4.getMissingUris as any)(...args),
  freshApi: () => tv4.freshApi(),
  normSchema: (...args: any[]) => (tv4.normSchema as any)(...args),
  errorCodes: Object.freeze({
    INVALID_TYPE: tv4.errorCodes.INVALID_TYPE,
    ENUM_MISMATCH: tv4.errorCodes.ENUM_MISMATCH,
    ANY_OF_MISSING: tv4.errorCodes.ANY_OF_MISSING,
    ONE_OF_MISSING: tv4.errorCodes.ONE_OF_MISSING,
    ONE_OF_MULTIPLE: tv4.errorCodes.ONE_OF_MULTIPLE,
    NOT_PASSED: tv4.errorCodes.NOT_PASSED,
    NUMBER_MULTIPLE_OF: tv4.errorCodes.NUMBER_MULTIPLE_OF,
    NUMBER_MINIMUM: tv4.errorCodes.NUMBER_MINIMUM,
    NUMBER_MINIMUM_EXCLUSIVE: tv4.errorCodes.NUMBER_MINIMUM_EXCLUSIVE,
    NUMBER_MAXIMUM: tv4.errorCodes.NUMBER_MAXIMUM,
    NUMBER_MAXIMUM_EXCLUSIVE: tv4.errorCodes.NUMBER_MAXIMUM_EXCLUSIVE,
    NUMBER_NOT_A_NUMBER: tv4.errorCodes.NUMBER_NOT_A_NUMBER,
    STRING_LENGTH_SHORT: tv4.errorCodes.STRING_LENGTH_SHORT,
    STRING_LENGTH_LONG: tv4.errorCodes.STRING_LENGTH_LONG,
    STRING_PATTERN: tv4.errorCodes.STRING_PATTERN,
    OBJECT_PROPERTIES_MINIMUM: tv4.errorCodes.OBJECT_PROPERTIES_MINIMUM,
    OBJECT_PROPERTIES_MAXIMUM: tv4.errorCodes.OBJECT_PROPERTIES_MAXIMUM,
    OBJECT_REQUIRED: tv4.errorCodes.OBJECT_REQUIRED,
    OBJECT_ADDITIONAL_PROPERTIES: tv4.errorCodes.OBJECT_ADDITIONAL_PROPERTIES,
    OBJECT_DEPENDENCY_KEY: tv4.errorCodes.OBJECT_DEPENDENCY_KEY,
    ARRAY_LENGTH_SHORT: tv4.errorCodes.ARRAY_LENGTH_SHORT,
    ARRAY_LENGTH_LONG: tv4.errorCodes.ARRAY_LENGTH_LONG,
    ARRAY_UNIQUE: tv4.errorCodes.ARRAY_UNIQUE,
    ARRAY_ADDITIONAL_ITEMS: tv4.errorCodes.ARRAY_ADDITIONAL_ITEMS,
    FORMAT_CUSTOM: tv4.errorCodes.FORMAT_CUSTOM,
    KEYWORD_CUSTOM: tv4.errorCodes.KEYWORD_CUSTOM,
    CIRCULAR_REFERENCE: tv4.errorCodes.CIRCULAR_REFERENCE,
    UNKNOWN_PROPERTY: tv4.errorCodes.UNKNOWN_PROPERTY,
  }),
  error: (tv4 as any).error,
  getDocumentUri: (...args: any[]) => (tv4 as any).getDocumentUri(...args),
  getSchemaMap: () => (tv4 as any).getSchemaMap(),
  getSchemaUris: (...args: any[]) => (tv4 as any).getSchemaUris(...args),
  language: (tv4 as any).language,
  missing: (tv4 as any).missing,
  resolveUrl: (base: string, url: string) => (tv4 as any).resolveUrl(base, url),
  valid: (tv4 as any).valid,
  // unsafe: addFormat (executes arbitrary code during validation)
  // unsafe: addLanguage (modifies global language state)
  // unsafe: addSchema (modifies global schema registry)
  // unsafe: defineError (modifies global error definitions)
  // unsafe: defineKeyword (executes arbitrary code during validation)
  // unsafe: dropSchemas (clears global schema registry)
  // unsafe: reset (clears all global tv4 state)
  // unsafe: setErrorReporter (executes arbitrary code on validation errors)
  // unsafe: tv4 (self-reference bypassing proxy, exposes all excluded methods)
};
const safeTv4 = new Proxy(safeTv4Methods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// uuid v9.0.1
const safeUuidMethods = {
  v1: (...args: any[]) => (uuid.v1 as any)(...args),
  v3: (...args: any[]) => (uuid.v3 as any)(...args),
  v4: (...args: any[]) => (uuid.v4 as any)(...args),
  v5: (...args: any[]) => (uuid.v5 as any)(...args),
  NIL: uuid.NIL,
  parse: (uuidStr: string) => uuid.parse(uuidStr),
  stringify: (bytes: ArrayLike<number>) => uuid.stringify(bytes),
  validate: (uuidStr: string) => uuid.validate(uuidStr),
  version: (uuidStr: string) => uuid.version(uuidStr),
};
const safeUuid = new Proxy(safeUuidMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// xml2js v0.6.2
const safeXml2jsMethods = {
  parseString: (...args: any[]) => (xml2js.parseString as any)(...args),
  parseStringPromise: (...args: any[]) => (xml2js.parseStringPromise as any)(...args),
  Builder: function SafeBuilder(options?: any) {
    return new xml2js.Builder(options);
  },
  Parser: function SafeParser(options?: any) {
    return new xml2js.Parser(options);
  },
  ValidationError: function SafeValidationError(message: string) {
    return new (xml2js as any).ValidationError(message);
  },
  processors: Object.freeze({
    normalize: (...args: any[]) => (xml2js.processors as any).normalize(...args),
    firstCharLowerCase: (...args: any[]) => (xml2js.processors as any).firstCharLowerCase(...args),
    stripPrefix: (...args: any[]) => (xml2js.processors as any).stripPrefix(...args),
    parseNumbers: (...args: any[]) => (xml2js.processors as any).parseNumbers(...args),
    parseBooleans: (...args: any[]) => (xml2js.processors as any).parseBooleans(...args),
  }),
  defaults: Object.freeze({
    '0.1': (xml2js.defaults as any)['0.1'],
    '0.2': (xml2js.defaults as any)['0.2'],
  }),
};
const safeXml2js = new Proxy(safeXml2jsMethods, {
  get(t, prop) {
    return (t as any)[prop];
  },
});

// Global: atob/btoa
const safeAtob = (str: string) => atob(str);
const safeBtoa = (str: string) => btoa(str);

const moduleMap: Record<string, unknown> = {
  assert: safeAssert,
  buffer: safeBuffer,
  events: safeEvents,
  path: safePath,
  punycode: safePunycode,
  querystring: safeQuerystring,
  stream: safeStream,
  string_decoder: safeStringDecoder,
  timers: safeTimers,
  url: safeUrl,
  util: safeUtil,
  ajv: safeAjv,
  chai: safeChai,
  cheerio: safeCheerio,
  'crypto-js': safeCryptoJs,
  'csv-parse/lib/sync': safeCsvParse,
  lodash: safeLodash,
  moment: safeMoment,
  tv4: safeTv4,
  uuid: safeUuid,
  xml2js: safeXml2js,
  atob: safeAtob,
  btoa: safeBtoa,
  'insomnia-collection': CollectionModule,
  'postman-collection': CollectionModule,
};

export const requireInterceptor = (moduleName: string): any => {
  if (Object.prototype.hasOwnProperty.call(moduleMap, moduleName)) {
    return moduleMap[moduleName];
  }
  throw new Error(`no module is found for "${moduleName}"`);
};
