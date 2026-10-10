import nodeQuerystring from 'node:querystring';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const noBridge: HostBridge = async bridgePath => {
  throw new Error(`unexpected bridge call: ${bridgePath}`);
};

const envelope = (grantedModules: string[]): ContextEnvelope => ({
  args: [],
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules,
  grantedCapabilities: [],
});

const runQuerystringTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var qs = require('querystring');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'querystring']),
    bridge: noBridge,
  });

describe('querystring regression suite', () => {
  describe('behavior', () => {
    it('parse() decodes percent-encoding and "+" as space', async () => {
      const result = await runQuerystringTag('return JSON.stringify(qs.parse("a=hello%20world&b=x%2By&c=one+two"));');
      expect(JSON.parse(result)).toEqual({ a: 'hello world', b: 'x+y', c: 'one two' });
    });

    it('parse() collects repeated keys into an array, in order', async () => {
      const result = await runQuerystringTag('return JSON.stringify(qs.parse("a=1&a=2&a=3"));');
      expect(JSON.parse(result)).toEqual({ a: ['1', '2', '3'] });
    });

    it('parse() treats a key with no "=" as an empty-string value', async () => {
      const result = await runQuerystringTag('return JSON.stringify(qs.parse("a"));');
      expect(JSON.parse(result)).toEqual({ a: '' });
    });

    it('parse() honors custom separator and equals characters', async () => {
      const result = await runQuerystringTag('return JSON.stringify(qs.parse("a:1;b:2", ";", ":"));');
      expect(JSON.parse(result)).toEqual({ a: '1', b: '2' });
    });

    it('parse() truncates to options.maxKeys, and 0 means unlimited', async () => {
      const truncated = await runQuerystringTag('return JSON.stringify(qs.parse("a=1&b=2&c=3", "&", "=", { maxKeys: 2 }));');
      expect(JSON.parse(truncated)).toEqual({ a: '1', b: '2' });
      const unlimited = await runQuerystringTag('return JSON.stringify(qs.parse("a=1&b=2&c=3", "&", "=", { maxKeys: 0 }));');
      expect(JSON.parse(unlimited)).toEqual({ a: '1', b: '2', c: '3' });
    });

    it('parse() result has a null prototype, so a "__proto__" key is just a data property', async () => {
      const result = await runQuerystringTag(`
        var r = qs.parse("__proto__=1&toString=2");
        return JSON.stringify({
          protoIsNull: Object.getPrototypeOf(r) === null,
          protoValue: r.__proto__,
          toStringValue: r.toString,
          globalProtoUnaffected: Object.getPrototypeOf({}) === Object.prototype,
        });
      `);
      expect(JSON.parse(result)).toEqual({
        protoIsNull: true,
        protoValue: '1',
        toStringValue: '2',
        globalProtoUnaffected: true,
      });
    });

    it('stringify() encodes values and repeats the key for array values', async () => {
      const result = await runQuerystringTag('return qs.stringify({ a: ["1", "2"], b: "hello world" });');
      expect(result).toBe('a=1&a=2&b=hello%20world');
    });

    it('stringify() maps null/undefined/NaN/Infinity/objects/functions to an empty value', async () => {
      const result = await runQuerystringTag(`
        return qs.stringify({ a: null, b: undefined, c: NaN, d: Infinity, e: {}, f: function () {}, g: -0, h: true });
      `);
      expect(result).toBe('a=&b=&c=&d=&e=&f=&g=0&h=true');
    });

    it('decode/encode are aliases of parse/stringify', async () => {
      const result = await runQuerystringTag('return JSON.stringify({ same1: qs.decode === qs.parse, same2: qs.encode === qs.stringify });');
      expect(JSON.parse(result)).toEqual({ same1: true, same2: true });
    });

    it('escape()/unescape() round-trip and unescape() does not treat "+" as space', async () => {
      const result = await runQuerystringTag(`
        return JSON.stringify({
          escaped: qs.escape("a b+c/d"),
          unescaped: qs.unescape("a%20b%2Bc"),
          plusUnchanged: qs.unescape("a+b"),
        });
      `);
      expect(JSON.parse(result)).toEqual({
        escaped: 'a%20b%2Bc%2Fd',
        unescaped: 'a b+c',
        plusUnchanged: 'a+b',
      });
    });

    it('unescape() falls back to the original string on malformed percent-encoding (documented gap)', async () => {
      const result = await runQuerystringTag('return qs.unescape("bad%");');
      expect(result).toBe('bad%');
    });

    it('parse() leaves a whole key/value undecoded if it contains malformed percent-encoding, even alongside well-formed escapes in the same token (documented gap, same root cause as unescape())', async () => {
      const input = 'a=100%zzhello%20';
      const result = await runQuerystringTag(`return JSON.stringify(qs.parse(${JSON.stringify(input)}));`);
      // The shim's fallback is all-or-nothing per key/value: because "%zz" is malformed, the
      // trailing well-formed "%20" is left undecoded too, unlike real Node (pinned below).
      expect(JSON.parse(result)).toEqual({ a: '100%zzhello%20' });
      expect(nodeQuerystring.parse(input)).toEqual({ a: '100%zzhello ' });
    });

    it('adversarial: a crafted "__proto__" query key cannot be used to write through to a real prototype, and repeated "__proto__" keys collect into an array like any other key', async () => {
      const result = await runQuerystringTag(`
        var r = qs.parse("__proto__=whatever");
        var beforeHasPolluted = ({}).polluted;
        try { r.__proto__.polluted = 'x'; } catch (e) { /* r.__proto__ is a string primitive, not a live prototype reference */ }
        var afterHasPolluted = ({}).polluted;
        var repeated = qs.parse("__proto__=1&__proto__=2");
        return JSON.stringify({
          typeofProto: typeof r.__proto__,
          beforeHasPolluted: beforeHasPolluted,
          afterHasPolluted: afterHasPolluted,
          repeatedIsArray: Array.isArray(repeated.__proto__),
          repeatedValue: repeated.__proto__,
          chainOk: Object.getPrototypeOf({}) === Object.prototype,
        });
      `);
      expect(JSON.parse(result)).toEqual({
        typeofProto: 'string',
        beforeHasPolluted: undefined,
        afterHasPolluted: undefined,
        repeatedIsArray: true,
        repeatedValue: ['1', '2'],
        chainOk: true,
      });
    });

    it('adversarial: a crafted "constructor" query key cannot reach the real Function constructor or its prototype', async () => {
      const result = await runQuerystringTag(`
        var r = qs.parse("constructor=zzz&constructor.prototype.polluted=1");
        var probe = {};
        return JSON.stringify({ probeHasPolluted: probe.polluted, ctorType: typeof r.constructor });
      `);
      expect(JSON.parse(result)).toEqual({ probeHasPolluted: undefined, ctorType: 'string' });
    });

    it('adversarial: a pollution attempt in one render cannot leak into a later, independent render', async () => {
      await runQuerystringTag('qs.parse("__proto__=1"); return "done";');
      const second = await runQuerystringTag(
        'return JSON.stringify({ chainOk: Object.getPrototypeOf({}) === Object.prototype, hasLeak: "polluted" in {} });',
      );
      expect(JSON.parse(second)).toEqual({ chainOk: true, hasLeak: false });
    });
  });

  describe('parity with real node:querystring', () => {
    it('parse() matches for a representative mixed query string', async () => {
      const input = 'a=1&a=2&b=hello%20world&c=x%2By&d&e=%E2%98%83';
      const sandboxResult = JSON.parse(await runQuerystringTag(`return JSON.stringify(qs.parse(${JSON.stringify(input)}));`));
      expect(sandboxResult).toEqual(nodeQuerystring.parse(input));
    });

    it('stringify() matches for representative value types', async () => {
      // `undefined` can't cross the JSON boundary into the sandbox source (JSON.stringify drops it) —
      // that case is covered directly in the behavioral test above instead.
      const obj = { a: [1, 2], b: 'hello world', c: null, e: true, f: -5 };
      const sandboxResult = await runQuerystringTag(`return qs.stringify(${JSON.stringify(obj)});`);
      expect(sandboxResult).toBe(nodeQuerystring.stringify(obj as unknown as Record<string, string>));
    });

    it('escape()/unescape() match for well-formed input', async () => {
      const sandboxResult = JSON.parse(
        await runQuerystringTag('return JSON.stringify({ escaped: qs.escape("a b/c+d"), unescaped: qs.unescape("a%20b%2Fc") });'),
      );
      expect(sandboxResult).toEqual({
        escaped: nodeQuerystring.escape('a b/c+d'),
        unescaped: nodeQuerystring.unescape('a%20b%2Fc'),
      });
    });
  });
});
