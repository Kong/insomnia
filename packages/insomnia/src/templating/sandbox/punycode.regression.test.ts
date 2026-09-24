import nodePunycode from 'node:punycode';

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

const runPunycodeTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var punycode = require('punycode');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'punycode']),
    bridge: noBridge,
  });

describe('punycode regression suite', () => {
  describe('behavior', () => {
    it('toASCII()/toUnicode() round-trip a non-ASCII domain label', async () => {
      const result = await runPunycodeTag('return JSON.stringify({ ascii: punycode.toASCII("bücher"), unicode: punycode.toUnicode("xn--bcher-kva") });');
      expect(JSON.parse(result)).toEqual({ ascii: 'xn--bcher-kva', unicode: 'bücher' });
    });

    it('toASCII() leaves already-ASCII labels and multi-label domains alone where appropriate', async () => {
      const result = await runPunycodeTag('return punycode.toASCII("straightforward-ascii.example.com");');
      expect(result).toBe('straightforward-ascii.example.com');
    });

    it('toASCII()/toUnicode() only convert the domain part of an email address', async () => {
      const result = await runPunycodeTag('return punycode.toASCII("user@例え.テスト");');
      expect(result).toBe('user@xn--r8jz45g.xn--zckzah');
    });

    it('encode()/decode() are the raw label-level primitives (no xn-- prefix)', async () => {
      const result = await runPunycodeTag('return JSON.stringify({ encoded: punycode.encode("bücher"), decoded: punycode.decode("bcher-kva") });');
      expect(JSON.parse(result)).toEqual({ encoded: 'bcher-kva', decoded: 'bücher' });
    });

    it('ucs2.decode()/ucs2.encode() convert between a string and an array of code points, handling surrogate pairs', async () => {
      const result = await runPunycodeTag('return JSON.stringify({ decoded: punycode.ucs2.decode("a😀b"), encoded: punycode.ucs2.encode([97, 128512, 98]) });');
      expect(JSON.parse(result)).toEqual({ decoded: [97, 128_512, 98], encoded: 'a😀b' });
    });

    it('decode() throws on malformed punycode input', async () => {
      await expect(runPunycodeTag('return punycode.decode("z");')).rejects.toThrow();
    });

    it('a basic (< 0x80) code point above the last delimiter must be plain ASCII', async () => {
      // Regression for a transcription bug: basicToDigit() must reject codepoints below each of its
      // three ranges (e.g. "@", which sits just below "A") rather than misclassifying them as digits.
      await expect(runPunycodeTag('return punycode.decode("foo@bar");')).rejects.toThrow('Invalid input');
    });

    it('a decoded value outside the valid Unicode range throws, rather than producing a bogus character', async () => {
      // Regression for a transcription bug: ucs2encode must validate range/left-to-right like real
      // Node's `String.fromCodePoint`, not silently wrap out-of-range values via fromCharCode.
      // Message casing is QuickJS's own native String.fromCodePoint wording, not this module's —
      // it differs from V8's ("invalid code point" vs Node's "Invalid code point N"), so this only
      // asserts on the substring both engines share.
      await expect(runPunycodeTag('return punycode.decode("7039m");')).rejects.toThrow(/code point/i);
    });

    it('U+007F (DEL) is treated as ASCII, so toASCII leaves the label unchanged', async () => {
      // Regression for a transcription bug: the non-ASCII regex must exclude \x7F, not just \x7E.
      const result = await runPunycodeTag('return punycode.toASCII("a\\u007Fb");');
      expect(result).toBe('a\u007Fb');
    });

    it('exposes a version string', async () => {
      const result = await runPunycodeTag('return typeof punycode.version;');
      expect(result).toBe('string');
    });
  });

  describe('parity with real node:punycode', () => {
    const domains = [
      'bücher', 'mañana', '他们为什么不说中文', 'straightforward-ascii', '☃', 'a😀b',
      '日本語。ドメイン。テスト', 'παράδειγμα.δοκιμή', 'straße', '3年b級ボール', 'ab',
    ];

    it.each(domains)('toASCII(%s) matches real node:punycode', async domain => {
      const sandboxResult = await runPunycodeTag(`return punycode.toASCII(${JSON.stringify(domain)});`);
      expect(sandboxResult).toBe(nodePunycode.toASCII(domain));
    });

    it.each(domains)('toUnicode(toASCII(%s)) round-trips through real node:punycode', async domain => {
      const ascii = nodePunycode.toASCII(domain);
      const sandboxResult = await runPunycodeTag(`return punycode.toUnicode(${JSON.stringify(ascii)});`);
      expect(sandboxResult).toBe(nodePunycode.toUnicode(ascii));
    });

    it('matches on malformed input error type and message shape', async () => {
      let realMessage = '';
      try {
        nodePunycode.decode('foo@bar');
      } catch (e) {
        realMessage = (e as Error).message;
      }
      await expect(runPunycodeTag('return punycode.decode("foo@bar");')).rejects.toThrow(realMessage);
    });
  });
});
