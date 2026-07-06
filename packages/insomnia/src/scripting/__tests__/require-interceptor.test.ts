import { describe, expect, it } from 'vitest';

import { requireInterceptor } from '../require-interceptor';

const allows = (moduleName: string) => expect(() => requireInterceptor(moduleName)).not.toThrow();

const blocks = (moduleName: string) => expect(() => requireInterceptor(moduleName)).toThrow();

describe('requireInterceptor', () => {
  describe('blocked modules', () => {
    it('blocks child_process', () => blocks('child_process'));
    it('blocks fs', () => blocks('fs'));
    it('blocks os', () => blocks('os'));
    it('blocks net', () => blocks('net'));
    it('blocks http', () => blocks('http'));
    it('blocks https', () => blocks('https'));
    it('blocks crypto', () => blocks('crypto'));
    it('blocks vm', () => blocks('vm'));
    it('blocks worker_threads', () => blocks('worker_threads'));
    it('blocks unknown module', () => blocks('some-unknown-module'));
  });

  describe('node built-ins', () => {
    it('allows path', () => allows('path'));
    it('allows assert', () => allows('assert'));
    it('allows url', () => allows('url'));
    it('allows punycode', () => allows('punycode'));
    it('allows querystring', () => allows('querystring'));
    it('allows string_decoder', () => allows('string_decoder'));
    it('allows stream', () => allows('stream'));
    it('allows events', () => allows('events'));
  });

  describe('timers', () => {
    it('allows timers', () => allows('timers'));

    // it('strips setImmediate from timers', () => {
    //   const timers = requireInterceptor('timers');
    //   expect(timers.setImmediate).toBeUndefined();
    // });

    it('strips queueMicrotask from timers', () => {
      const timers = requireInterceptor('timers');
      expect(timers.queueMicrotask).toBeUndefined();
    });

    it('preserves setTimeout in timers', () => {
      const timers = requireInterceptor('timers');
      expect(timers.setTimeout).toBeDefined();
    });

    it('preserves setInterval in timers', () => {
      const timers = requireInterceptor('timers');
      expect(timers.setInterval).toBeDefined();
    });
  });

  describe('buffer', () => {
    it('allows buffer', () => allows('buffer'));

    it('blocks Buffer.allocUnsafe', () => {
      const { Buffer: SafeBuffer } = requireInterceptor('buffer');
      expect(() => SafeBuffer.allocUnsafe(8)).toThrow('Buffer.allocUnsafe is not available in sandbox scripts');
    });

    it('blocks Buffer.allocUnsafeSlow', () => {
      const { Buffer: SafeBuffer } = requireInterceptor('buffer');
      expect(() => SafeBuffer.allocUnsafeSlow(8)).toThrow('Buffer.allocUnsafeSlow is not available in sandbox scripts');
    });

    it('allows Buffer.alloc', () => {
      const { Buffer: SafeBuffer } = requireInterceptor('buffer');
      expect(() => SafeBuffer.alloc(8)).not.toThrow();
    });

    it('allows Buffer.from', () => {
      const { Buffer: SafeBuffer } = requireInterceptor('buffer');
      expect(() => SafeBuffer.from('hello')).not.toThrow();
    });
  });

  describe('util', () => {
    it('allows util', () => allows('util'));

    it('blocks util.inherits', () => {
      const util = requireInterceptor('util');
      expect(() => util.inherits()).toThrow('util.inherits is not available in sandbox scripts');
    });

    it('blocks util.debuglog', () => {
      const util = requireInterceptor('util');
      expect(() => util.debuglog()).toThrow('util.debuglog is not available in sandbox scripts');
    });

    it('allows util.format', () => {
      const util = requireInterceptor('util');
      expect(() => util.format('%s', 'hello')).not.toThrow();
    });

    it('allows util.inspect', () => {
      const util = requireInterceptor('util');
      expect(() => util.inspect({})).not.toThrow();
    });
  });

  describe('external modules', () => {
    it('allows ajv', () => allows('ajv'));
    it('allows chai', () => allows('chai'));
    it('allows cheerio', () => allows('cheerio'));
    it('allows crypto-js', () => allows('crypto-js'));
    it('allows csv-parse/lib/sync', () => allows('csv-parse/lib/sync'));
    it('allows lodash', () => allows('lodash'));
    it('allows moment', () => allows('moment'));
    it('allows tv4', () => allows('tv4'));
    it('allows uuid', () => allows('uuid'));
    it('allows xml2js', () => allows('xml2js'));
  });

  describe('base64 helpers', () => {
    it('allows atob', () => allows('atob'));
    it('allows btoa', () => allows('btoa'));

    it('atob returns a function', () => {
      expect(typeof requireInterceptor('atob')).toBe('function');
    });

    it('btoa returns a function', () => {
      expect(typeof requireInterceptor('btoa')).toBe('function');
    });
  });

  describe('collection modules', () => {
    it('allows insomnia-collection', () => allows('insomnia-collection'));
    it('allows postman-collection', () => allows('postman-collection'));

    it('insomnia-collection and postman-collection return the same module', () => {
      expect(requireInterceptor('insomnia-collection')).toBe(requireInterceptor('postman-collection'));
    });
  });
});
