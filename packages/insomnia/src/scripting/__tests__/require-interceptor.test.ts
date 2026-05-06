import * as actualBuffer from 'node:buffer';
import actualPath from 'node:path';
import * as actualPunycode from 'node:punycode';
import * as actualQuerystring from 'node:querystring';
import * as actualUrl from 'node:url';
import { format as actualUtilFormat, inspect as actualUtilInspect } from 'node:util';

import actualCryptoJs from 'crypto-js';
import actualLodash from 'es-toolkit/compat';
import { camelCase, cloneDeep, groupBy, isEqual, isNil, kebabCase, merge, omit, orderBy, pick, snakeCase, sortBy } from 'es-toolkit/compat';
import actualMoment from 'moment';
import * as actualUuid from 'uuid';
import { describe, expect, it } from 'vitest';

import { requireInterceptor } from '../require-interceptor';

const allows = (moduleName: string) =>
  expect(() => requireInterceptor(moduleName)).not.toThrow();

const blocks = (moduleName: string) =>
  expect(() => requireInterceptor(moduleName)).toThrow();

describe('requireInterceptor', () => {
  describe('module access control', () => {
    describe('blocked system modules', () => {
      it('blocks child_process', () => blocks('child_process'));
      it('blocks fs',            () => blocks('fs'));
      it('blocks os',            () => blocks('os'));
      it('blocks net',           () => blocks('net'));
      it('blocks http',          () => blocks('http'));
      it('blocks https',         () => blocks('https'));
      it('blocks crypto',        () => blocks('crypto'));
      it('blocks vm',            () => blocks('vm'));
      it('blocks worker_threads', () => blocks('worker_threads'));
      it('blocks unknown module', () => blocks('some-unknown-module'));
    });

    describe('allowed node built-ins', () => {
      it('allows path',           () => allows('path'));
      it('allows assert',         () => allows('assert'));
      it('allows url',            () => allows('url'));
      it('allows punycode',       () => allows('punycode'));
      it('allows querystring',    () => allows('querystring'));
      it('allows string_decoder', () => allows('string_decoder'));
      it('allows stream',         () => allows('stream'));
      it('allows events',         () => allows('events'));
      it('allows buffer',         () => allows('buffer'));
      it('allows timers',         () => allows('timers'));
      it('allows util',           () => allows('util'));
    });

    describe('allowed external modules', () => {
      it('allows ajv',              () => allows('ajv'));
      it('allows chai',             () => allows('chai'));
      it('allows cheerio',          () => allows('cheerio'));
      it('allows crypto-js',        () => allows('crypto-js'));
      it('allows csv-parse/lib/sync', () => allows('csv-parse/lib/sync'));
      it('allows lodash',           () => allows('lodash'));
      it('allows moment',           () => allows('moment'));
      it('allows tv4',              () => allows('tv4'));
      it('allows uuid',             () => allows('uuid'));
      it('allows xml2js',           () => allows('xml2js'));
    });

    describe('allowed base64 helpers', () => {
      it('allows atob', () => allows('atob'));
      it('allows btoa', () => allows('btoa'));
      it('atob returns a function', () => {
        expect(typeof requireInterceptor('atob')).toBe('function');
      });
      it('btoa returns a function', () => {
        expect(typeof requireInterceptor('btoa')).toBe('function');
      });
    });

    describe('allowed collection modules', () => {
      it('allows insomnia-collection',  () => allows('insomnia-collection'));
      it('allows postman-collection',   () => allows('postman-collection'));
      it('insomnia-collection and postman-collection return the same module', () => {
        expect(requireInterceptor('insomnia-collection')).toBe(requireInterceptor('postman-collection'));
      });
    });
  });

  describe('output parity with direct imports', () => {
    describe('path module', () => {
      it('path.join produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.join('a', 'b', 'c')).toBe(actualPath.join('a', 'b', 'c'));
      });

      it('path.dirname produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.dirname('/foo/bar/baz.js')).toBe(actualPath.dirname('/foo/bar/baz.js'));
      });

      it('path.basename produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.basename('/foo/bar/baz.js')).toBe(actualPath.basename('/foo/bar/baz.js'));
      });

      it('path.extname produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.extname('/foo/bar.baz.js')).toBe(actualPath.extname('/foo/bar.baz.js'));
      });

      it('path.resolve produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.resolve('foo', 'bar')).toBe(actualPath.resolve('foo', 'bar'));
      });

      it('path.posix.join produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.posix.join('a', 'b', 'c')).toBe(actualPath.posix.join('a', 'b', 'c'));
      });

      it('path.win32.join produces identical output', () => {
        const pathViaInterceptor = requireInterceptor('path');
        expect(pathViaInterceptor.win32.join('a', 'b', 'c')).toBe(actualPath.win32.join('a', 'b', 'c'));
      });
    });

    describe('querystring module', () => {
      it('querystring.stringify produces identical output', () => {
        const qsViaInterceptor = requireInterceptor('querystring');
        const obj = { a: '1', b: '2', c: 'hello' };
        expect(qsViaInterceptor.stringify(obj)).toBe(actualQuerystring.stringify(obj));
      });

      it('querystring.parse produces identical output', () => {
        const qsViaInterceptor = requireInterceptor('querystring');
        const str = 'a=1&b=2&c=hello';
        expect(qsViaInterceptor.parse(str)).toEqual(actualQuerystring.parse(str));
      });

      it('querystring roundtrip preserves data', () => {
        const qsViaInterceptor = requireInterceptor('querystring');
        const original = { foo: 'bar', baz: 'qux' };
        const parsed = qsViaInterceptor.parse(qsViaInterceptor.stringify(original));
        expect(parsed).toEqual(original);
      });
    });

    describe('url module', () => {
      it('URL constructor produces identical href', () => {
        const urlViaInterceptor = requireInterceptor('url');
        expect(new urlViaInterceptor.URL('https://example.com/path?q=1').href)
          .toBe(new actualUrl.URL('https://example.com/path?q=1').href);
      });

      it('URL.hostname produces identical output', () => {
        const urlViaInterceptor = requireInterceptor('url');
        expect(new urlViaInterceptor.URL('https://example.com:8080/path').hostname)
          .toBe(new actualUrl.URL('https://example.com:8080/path').hostname);
      });

      it('URL.pathname produces identical output', () => {
        const urlViaInterceptor = requireInterceptor('url');
        expect(new urlViaInterceptor.URL('https://example.com/foo/bar').pathname)
          .toBe(new actualUrl.URL('https://example.com/foo/bar').pathname);
      });

      it('URLSearchParams.toString produces identical output', () => {
        const urlViaInterceptor = requireInterceptor('url');
        expect(new urlViaInterceptor.URLSearchParams('a=1&b=2').toString())
          .toBe(new actualUrl.URLSearchParams('a=1&b=2').toString());
      });
    });

    describe('util module', () => {
      it('util.format produces identical output', () => {
        const utilViaInterceptor = requireInterceptor('util');
        expect(utilViaInterceptor.format('%s %d', 'hello', 42)).toBe(actualUtilFormat('%s %d', 'hello', 42));
      });

      it('util.inspect produces identical output', () => {
        const utilViaInterceptor = requireInterceptor('util');
        const obj = { a: 1, b: 'test' };
        expect(utilViaInterceptor.inspect(obj)).toBe(actualUtilInspect(obj));
      });

      it('util.inspect with options produces identical output', () => {
        const utilViaInterceptor = requireInterceptor('util');
        const obj = { a: 1, b: 'test' };
        expect(utilViaInterceptor.inspect(obj, { depth: 2 })).toBe(actualUtilInspect(obj, { depth: 2 }));
      });
    });

    describe('buffer module', () => {
      it('Buffer.from produces identical content', () => {
        const bufferViaInterceptor = requireInterceptor('buffer');
        expect(bufferViaInterceptor.Buffer.from('hello').toString())
          .toBe(actualBuffer.Buffer.from('hello').toString());
      });

      it('Buffer.alloc produces buffers of identical size', () => {
        const bufferViaInterceptor = requireInterceptor('buffer');
        expect(bufferViaInterceptor.Buffer.alloc(10).length).toBe(actualBuffer.Buffer.alloc(10).length);
      });

      it('Buffer.byteLength produces identical result', () => {
        const bufferViaInterceptor = requireInterceptor('buffer');
        expect(bufferViaInterceptor.Buffer.byteLength('hello')).toBe(actualBuffer.Buffer.byteLength('hello'));
      });

      it('Buffer.concat produces identical result', () => {
        const bufferViaInterceptor = requireInterceptor('buffer');
        const result1 = bufferViaInterceptor.Buffer.concat([
          bufferViaInterceptor.Buffer.from('hello'),
          bufferViaInterceptor.Buffer.from('world'),
        ]);
        const result2 = actualBuffer.Buffer.concat([
          actualBuffer.Buffer.from('hello'),
          actualBuffer.Buffer.from('world'),
        ]);
        expect(result1.toString()).toBe(result2.toString());
      });

      it('Buffer.isBuffer correctly identifies buffers', () => {
        const bufferViaInterceptor = requireInterceptor('buffer');
        const buf = bufferViaInterceptor.Buffer.from('hello');
        expect(bufferViaInterceptor.Buffer.isBuffer(buf)).toBe(true);
        expect(bufferViaInterceptor.Buffer.isBuffer('not a buffer')).toBe(false);
      });
    });

    describe('punycode module', () => {
      it('punycode.encode produces identical output', () => {
        const punycodeViaInterceptor = requireInterceptor('punycode');
        expect(punycodeViaInterceptor.encode('mañana')).toBe(actualPunycode.encode('mañana'));
      });

      it('punycode roundtrip preserves original', () => {
        const punycodeViaInterceptor = requireInterceptor('punycode');
        const original = 'mañana';
        expect(punycodeViaInterceptor.decode(punycodeViaInterceptor.encode(original))).toBe(original);
      });

      it('punycode.ucs2.encode produces identical output', () => {
        const punycodeViaInterceptor = requireInterceptor('punycode');
        const codePoints = [72, 101, 108, 108, 111];
        expect(punycodeViaInterceptor.ucs2.encode(codePoints)).toBe(actualPunycode.ucs2.encode(codePoints));
      });
    });

    describe('base64 helpers', () => {
      it('btoa produces correct base64 output', () => {
        const btoa = requireInterceptor('btoa');
        expect(btoa('hello')).toBe('aGVsbG8=');
      });

      it('atob decodes base64 correctly', () => {
        const atob = requireInterceptor('atob');
        expect(atob('aGVsbG8=')).toBe('hello');
      });

      it('atob/btoa roundtrip preserves content', () => {
        const atob = requireInterceptor('atob');
        const btoa = requireInterceptor('btoa');
        const original = 'hello world';
        expect(atob(btoa(original))).toBe(original);
      });
    });

    describe('crypto-js module', () => {
      it('CryptoJS.MD5 produces consistent hash', () => {
        const cryptoJsViaInterceptor = requireInterceptor('crypto-js');
        expect(cryptoJsViaInterceptor.MD5('hello').toString()).toBe(actualCryptoJs.MD5('hello').toString());
      });

      it('CryptoJS.SHA256 produces consistent hash', () => {
        const cryptoJsViaInterceptor = requireInterceptor('crypto-js');
        expect(cryptoJsViaInterceptor.SHA256('hello').toString()).toBe(actualCryptoJs.SHA256('hello').toString());
      });

      it('CryptoJS.enc.Base64 encoding matches', () => {
        const cryptoJsViaInterceptor = requireInterceptor('crypto-js');
        const result1 = cryptoJsViaInterceptor.enc.Base64.stringify(cryptoJsViaInterceptor.enc.Utf8.parse('hello'));
        const result2 = actualCryptoJs.enc.Base64.stringify(actualCryptoJs.enc.Utf8.parse('hello'));
        expect(result1).toBe(result2);
      });
    });

    describe('uuid module', () => {
      it('uuid.v4 produces valid UUIDs', () => {
        const uuidViaInterceptor = requireInterceptor('uuid');
        const id = uuidViaInterceptor.v4();
        expect(uuidViaInterceptor.validate(id)).toBe(true);
      });

      it('uuid.validate rejects invalid strings', () => {
        const uuidViaInterceptor = requireInterceptor('uuid');
        expect(uuidViaInterceptor.validate('not-a-uuid')).toBe(false);
      });

      it('uuid.version returns correct version for generated UUID', () => {
        const uuidViaInterceptor = requireInterceptor('uuid');
        const id = uuidViaInterceptor.v4();
        expect(uuidViaInterceptor.version(id)).toBe(4);
      });

      it('uuid.stringify/parse roundtrip matches original', () => {
        const uuidViaInterceptor = requireInterceptor('uuid');
        const id = uuidViaInterceptor.v4();
        expect(uuidViaInterceptor.stringify(uuidViaInterceptor.parse(id))).toBe(id);
      });

      it('uuid.v4 and uuid.validate match actual library', () => {
        const uuidViaInterceptor = requireInterceptor('uuid');
        const id = uuidViaInterceptor.v4();
        expect(actualUuid.validate(id)).toBe(true);
        expect(actualUuid.version(id)).toBe(4);
      });
    });

    describe('moment module', () => {
      it('moment.utc format matches actual', () => {
        const momentViaInterceptor = requireInterceptor('moment');
        expect(momentViaInterceptor.utc('2020-06-15', 'YYYY-MM-DD').format('YYYY-MM-DD'))
          .toBe(actualMoment.utc('2020-06-15', 'YYYY-MM-DD').format('YYYY-MM-DD'));
      });

      it('moment.duration.asDays matches actual', () => {
        const momentViaInterceptor = requireInterceptor('moment');
        expect(momentViaInterceptor.duration(5, 'days').asDays())
          .toBe(actualMoment.duration(5, 'days').asDays());
      });

      it('moment.isMoment correctly identifies moment objects', () => {
        const momentViaInterceptor = requireInterceptor('moment');
        const momentObj = momentViaInterceptor.utc('2020-06-15');
        expect(momentViaInterceptor.isMoment(momentObj)).toBe(true);
        expect(momentViaInterceptor.isMoment('not a moment')).toBe(false);
      });

      it('moment.now returns current timestamp within 100ms', () => {
        const momentViaInterceptor = requireInterceptor('moment');
        expect(Math.abs(momentViaInterceptor.now() - actualMoment.now())).toBeLessThan(100);
      });
    });

    describe('lodash module — array methods', () => {
      it('chunk produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.chunk([1, 2, 3, 4, 5], 2)).toEqual(actualLodash.chunk([1, 2, 3, 4, 5], 2));
      });

      it('flatten produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        // eslint-disable-next-line unicorn/prefer-array-flat
        expect(lodash.flatten([[1, 2], [3, 4]])).toEqual(actualLodash.flatten([[1, 2], [3, 4]]));
      });

      it('uniq produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.uniq([1, 2, 2, 3, 3, 3])).toEqual(actualLodash.uniq([1, 2, 2, 3, 3, 3]));
      });

      it('sortBy produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const arr = [{ n: 3 }, { n: 1 }, { n: 2 }];
        expect(lodash.sortBy(arr, 'n')).toEqual(sortBy(arr, [(x: any) => x.n]));
      });

      it('orderBy produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const arr = [{ n: 1, s: 'b' }, { n: 2, s: 'a' }, { n: 1, s: 'a' }];
        expect(lodash.orderBy(arr, ['n', 's'], ['asc', 'desc']))
          .toEqual(orderBy(arr, [(x: any) => x.n, (x: any) => x.s], ['asc', 'desc']));
      });

      it('flattenDeep produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.flattenDeep([1, [2, [3, [4]]]])).toEqual(actualLodash.flattenDeep([1, [2, [3, [4]]]]));
      });

      it('compact removes falsy values', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.compact([0, 1, false, 2, '', 3])).toEqual(actualLodash.compact([0, 1, false, 2, '', 3]));
      });

      it('difference produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.difference([1, 2, 3, 4], [2, 4])).toEqual(actualLodash.difference([1, 2, 3, 4], [2, 4]));
      });

      it('intersection produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.intersection([1, 2, 3], [2, 3, 4])).toEqual(actualLodash.intersection([1, 2, 3], [2, 3, 4]));
      });

      it('uniqBy produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const arr = [{ id: 1, name: 'a' }, { id: 1, name: 'b' }, { id: 2, name: 'c' }];
        expect(lodash.uniqBy(arr, 'id')).toEqual(actualLodash.uniqBy(arr, 'id'));
      });

      it('take produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.take([1, 2, 3, 4, 5], 3)).toEqual(actualLodash.take([1, 2, 3, 4, 5], 3));
      });

      it('drop produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.drop([1, 2, 3, 4, 5], 2)).toEqual(actualLodash.drop([1, 2, 3, 4, 5], 2));
      });
    });

    describe('lodash module — object methods', () => {
      it('omit produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const obj = { a: 1, b: 2, c: 3 };
        expect(lodash.omit(obj, ['b'])).toEqual(omit(obj, ['b']));
      });

      it('pick produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const obj = { a: 1, b: 2, c: 3 };
        expect(lodash.pick(obj, ['a', 'c'])).toEqual(pick(obj, ['a', 'c']));
      });

      it('merge produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const obj1 = { a: 1, b: { x: 1 } };
        const obj2 = { b: { y: 2 }, c: 3 };
        expect(lodash.merge({}, obj1, obj2)).toEqual(merge({}, obj1, obj2));
      });

      it('cloneDeep produces a deep copy', () => {
        const lodash = requireInterceptor('lodash');
        const original = { a: { b: { c: 1 } } };
        // eslint-disable-next-line unicorn/prefer-structured-clone
        const clone = lodash.cloneDeep(original);
        expect(clone).toEqual(cloneDeep(original));
        clone.a.b.c = 99;
        expect(original.a.b.c).toBe(1);
      });

      it('groupBy produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const arr = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
        expect(lodash.groupBy(arr, 'type')).toEqual(groupBy(arr, (x: any) => x.type));
      });

      it('keyBy produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const arr = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
        expect(lodash.keyBy(arr, 'id')).toEqual(actualLodash.keyBy(arr, 'id'));
      });

      it('mapValues produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        const obj = { a: 1, b: 2, c: 3 };
        expect(lodash.mapValues(obj, (v: number) => v * 2)).toEqual(actualLodash.mapValues(obj, v => v * 2));
      });

      it('isEqual returns true for deep-equal objects', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(isEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }));
      });

      it('isEqual returns false for non-equal objects', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isEqual({ a: 1 }, { a: 2 })).toBe(false);
      });
    });

    describe('lodash module — string methods', () => {
      it('camelCase produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.camelCase('hello world')).toBe(camelCase('hello world'));
      });

      it('snakeCase produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.snakeCase('helloWorld')).toBe(snakeCase('helloWorld'));
      });

      it('kebabCase produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.kebabCase('Hello World')).toBe(kebabCase('Hello World'));
      });

      it('capitalize produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.capitalize('hello world')).toBe(actualLodash.capitalize('hello world'));
      });

      it('trim produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.trim('  hello  ')).toBe(actualLodash.trim('  hello  '));
      });

      it('escape escapes HTML characters', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.escape('<div class="foo">hello & world</div>'))
          .toBe(actualLodash.escape('<div class="foo">hello & world</div>'));
      });

      it('unescape reverses escape', () => {
        const lodash = requireInterceptor('lodash');
        const original = '<div class="foo">hello & world</div>';
        expect(lodash.unescape(lodash.escape(original))).toBe(original);
      });
    });

    describe('lodash module — type checks and utilities', () => {
      it('isNil returns true for null and undefined', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isNil(null)).toBe(isNil(null));
        // eslint-disable-next-line unicorn/no-useless-undefined
        expect(lodash.isNil(undefined)).toBe(isNil(undefined));
        expect(lodash.isNil(0)).toBe(isNil(0));
      });

      it('isNumber identifies numbers correctly', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isNumber(42)).toBe(actualLodash.isNumber(42));
        expect(lodash.isNumber('42')).toBe(actualLodash.isNumber('42'));
      });

      it('isString identifies strings correctly', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isString('hello')).toBe(actualLodash.isString('hello'));
        expect(lodash.isString(42)).toBe(actualLodash.isString(42));
      });

      it('isBoolean identifies booleans correctly', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isBoolean(true)).toBe(actualLodash.isBoolean(true));
        expect(lodash.isBoolean(1)).toBe(actualLodash.isBoolean(1));
      });

      it('isPlainObject identifies plain objects correctly', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.isPlainObject({})).toBe(actualLodash.isPlainObject({}));
        expect(lodash.isPlainObject([])).toBe(actualLodash.isPlainObject([]));
      });

      it('range produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.range(0, 5)).toEqual(actualLodash.range(0, 5));
        expect(lodash.range(0, 10, 2)).toEqual(actualLodash.range(0, 10, 2));
      });

      it('sum produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.sum([1, 2, 3, 4, 5])).toBe(actualLodash.sum([1, 2, 3, 4, 5]));
      });

      it('mean produces identical result', () => {
        const lodash = requireInterceptor('lodash');
        expect(lodash.mean([1, 2, 3, 4, 5])).toBe(actualLodash.mean([1, 2, 3, 4, 5]));
      });
    });
  });

  describe('blocked methods and properties', () => {
    describe('buffer', () => {
      it('Buffer.allocUnsafe throws descriptive error', () => {
        const { Buffer: SafeBuffer } = requireInterceptor('buffer');
        expect(() => SafeBuffer.allocUnsafe(8)).toThrow('Buffer.allocUnsafe is not available in sandbox scripts');
      });

      it('Buffer.allocUnsafeSlow throws descriptive error', () => {
        const { Buffer: SafeBuffer } = requireInterceptor('buffer');
        expect(() => SafeBuffer.allocUnsafeSlow(8)).toThrow('Buffer.allocUnsafeSlow is not available in sandbox scripts');
      });

      it('Buffer.alloc is available', () => {
        const { Buffer: SafeBuffer } = requireInterceptor('buffer');
        expect(() => SafeBuffer.alloc(8)).not.toThrow();
      });

      it('Buffer.from is available', () => {
        const { Buffer: SafeBuffer } = requireInterceptor('buffer');
        expect(() => SafeBuffer.from('hello')).not.toThrow();
      });
    });

    describe('util', () => {
      it('util.inherits is undefined', () => {
        expect(requireInterceptor('util').inherits).toBeUndefined();
      });

      it('util.debuglog is undefined', () => {
        expect(requireInterceptor('util').debuglog).toBeUndefined();
      });

      it('util.format is available', () => {
        expect(() => requireInterceptor('util').format('%s', 'hello')).not.toThrow();
      });

      it('util.inspect is available', () => {
        expect(() => requireInterceptor('util').inspect({})).not.toThrow();
      });
    });

    describe('timers', () => {
      it('timers.queueMicrotask is undefined', () => {
        expect(requireInterceptor('timers').queueMicrotask).toBeUndefined();
      });

      it('timers.setTimeout is available', () => {
        expect(requireInterceptor('timers').setTimeout).toBeDefined();
      });

      it('timers.setInterval is available', () => {
        expect(requireInterceptor('timers').setInterval).toBeDefined();
      });
    });

    describe('lodash', () => {
      it('lodash.template is undefined', () => {
        expect(requireInterceptor('lodash').template).toBeUndefined();
      });

      it('lodash.runInContext is undefined', () => {
        expect(requireInterceptor('lodash').runInContext).toBeUndefined();
      });
    });

    describe('moment', () => {
      it('moment.fn is undefined', () => {
        expect(requireInterceptor('moment').fn).toBeUndefined();
      });
    });

    describe('tv4', () => {
      it('tv4.addSchema is undefined', () => {
        expect(requireInterceptor('tv4').addSchema).toBeUndefined();
      });
    });

    describe('cheerio', () => {
      it('cheerio.fromURL is undefined', () => {
        expect(requireInterceptor('cheerio').fromURL).toBeUndefined();
      });
    });
  });
});
