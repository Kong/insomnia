import { StringDecoder as NodeStringDecoder } from 'node:string_decoder';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const noBridge: HostBridge = async bridgePath => {
  throw new Error(`unexpected bridge call: ${bridgePath}`);
};

const envelope = (args: unknown[]): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules: ['path', 'crypto', 'string_decoder'],
  grantedCapabilities: [],
});

// Runs a fixed sequence of write() calls (plus a trailing end()) through the sandboxed decoder and
// returns each call's result as a JSON-encoded array of strings. `encoding`/`chunks` cross into the
// sandbox as envelope args (data), never interpolated into the eval'd source.
const runDecoderSequence = async (encoding: string, chunks: number[][]) => {
  const raw = await runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var SD = require('string_decoder').StringDecoder;
      var enc = arguments[1];
      var chunks = arguments[2];
      var d = new SD(enc);
      var out = [];
      for (var i = 0; i < chunks.length; i++) { out.push(d.write(new Uint8Array(chunks[i]))); }
      out.push(d.end());
      return JSON.stringify(out);
    } }];`,
    tagName: 't',
    envelope: envelope([encoding, chunks]),
    bridge: noBridge,
  });
  return JSON.parse(raw) as string[];
};

const nodeDecoderSequence = (encoding: string, chunks: number[][]) => {
  const d = new NodeStringDecoder(encoding as BufferEncoding);
  const out = chunks.map(chunk => d.write(Buffer.from(chunk)));
  out.push(d.end());
  return out;
};

// Asserts the sandboxed decoder produces the exact same per-call and final output as the real
// `node:string_decoder`, given the identical write()/end() call sequence.
const expectParity = async (encoding: string, chunks: number[][]) => {
  const actual = await runDecoderSequence(encoding, chunks);
  expect(actual).toEqual(nodeDecoderSequence(encoding, chunks));
};

const utf8Bytes = (s: string): number[] => Array.from(Buffer.from(s, 'utf8'));
const utf16leBytes = (s: string): number[] => Array.from(Buffer.from(s, 'utf16le'));

// Splits a byte array into chunks at the given cut points (byte offsets), for exercising every
// write() boundary a multi-byte sequence could be split at.
const splitAt = (bytes: number[], cuts: number[]): number[][] => {
  const points = [0, ...cuts, bytes.length];
  const out: number[][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push(bytes.slice(points[i], points[i + 1]));
  }
  return out;
};

describe('string_decoder regression suite', () => {
  it('throws on an unknown encoding, matching node:string_decoder', async () => {
    await expect(runDecoderSequence('bogus-encoding', [[1]])).rejects.toThrow('Unknown encoding: bogus-encoding');
    expect(() => new NodeStringDecoder('bogus-encoding' as BufferEncoding)).toThrow('Unknown encoding: bogus-encoding');
  });

  it('defaults to utf8 when no encoding is given', async () => {
    const actual = await runTagInSandbox({
      pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
        var SD = require('string_decoder').StringDecoder;
        var d = new SD();
        return d.encoding;
      } }];`,
      tagName: 't',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe('utf8');
  });

  it('write([]) / write of an empty chunk returns an empty string', async () => {
    await expectParity('utf8', [[]]);
  });

  describe.each(['ascii', 'latin1', 'binary', 'hex', 'utf8', 'utf16le', 'ucs2', 'base64'])('encoding %s', encoding => {
    it('decodes a plain single-write ASCII string with no buffering needed', async () => {
      await expectParity(encoding, [utf8Bytes('hello world')]);
    });
  });

  it('ascii masks the high bit per byte, matching Buffer.toString("ascii")', async () => {
    await expectParity('ascii', [[0xe9, 0x41, 0xff]]);
  });

  it('latin1 passes every byte through unmodified', async () => {
    await expectParity('latin1', [[0xe9, 0x00, 0xff, 0x41]]);
  });

  it('hex never buffers — each byte independently maps to a pair', async () => {
    await expectParity('hex', [[0xde, 0xad], [0xbe, 0xef, 0x01]]);
  });

  describe('utf8 multi-byte boundary buffering', () => {
    it.each([
      'e',
      '€',
      '👋',
      'a€b👋c',
      'héllo wörld',
    ])('splits %j at every possible byte offset and matches node:string_decoder', async str => {
      const bytes = utf8Bytes(str);
      for (let cut = 1; cut < bytes.length; cut++) {
        await expectParity('utf8', splitAt(bytes, [cut]));
      }
    });

    it('splits a 4-byte emoji across three separate writes', async () => {
      const bytes = utf8Bytes('👋');
      await expectParity('utf8', splitAt(bytes, [1, 3]));
    });

    it('end() emits a replacement character for a truncated trailing sequence', async () => {
      // 0xE2 0x82 is the first two bytes of the 3-byte sequence for '€' (0xE2 0x82 0xAC) — never
      // completed before end().
      await expectParity('utf8', [[0xe2, 0x82]]);
    });

    it.each([
      [[0x80]], // stray continuation byte, no leading byte
      [[0xc2]], // truncated 2-byte lead, never completed
      [[0xe0, 0x80, 0x80]], // overlong-encoding lead byte with an out-of-range continuation
      [[0xf5, 0x80, 0x80, 0x80]], // lead byte above the valid F0-F4 range
      [[0xc2, 0x41]], // continuation byte replaced by an ASCII byte mid-sequence
    ])('malformed byte sequence %j decodes to the same replacement characters as real Node', async chunk => {
      await expectParity('utf8', [chunk]);
    });
  });

  describe('utf16le / ucs2 multi-byte boundary buffering', () => {
    it.each(['a', 'ab', 'a€', '👋x', 'héllo wörld'])('splits %j at every possible byte offset and matches node:string_decoder', async str => {
      const bytes = utf16leBytes(str);
      for (let cut = 1; cut < bytes.length; cut++) {
        await expectParity('utf16le', splitAt(bytes, [cut]));
      }
    });

    it('holds a trailing high surrogate until the low surrogate arrives in the next write', async () => {
      const bytes = utf16leBytes('a👋b');
      // Cut right after the high-surrogate unit (byte offset 4), matching the classic case the
      // decoder must special-case (an even-length write ending on a high surrogate).
      await expectParity('utf16le', splitAt(bytes, [4]));
    });

    it('buffers a single odd trailing byte', async () => {
      const bytes = utf16leBytes('ab');
      await expectParity('utf16le', [bytes.slice(0, 3), bytes.slice(3)]);
    });

    it('ucs2 is an alias for utf16le', async () => {
      const bytes = utf16leBytes('a€b');
      const actual = await runDecoderSequence('ucs2', splitAt(bytes, [1]));
      expect(actual).toEqual(nodeDecoderSequence('utf16le', splitAt(bytes, [1])));
    });
  });

  describe('base64 multi-byte boundary buffering', () => {
    it.each(['a', 'ab', 'abc', 'abcd', 'hello world', '👋'])('splits %j at every possible byte offset and matches node:string_decoder', async str => {
      const bytes = utf8Bytes(str);
      for (let cut = 1; cut < bytes.length; cut++) {
        await expectParity('base64', splitAt(bytes, [cut]));
      }
    });
  });

  it('write() accepts a plain byte array, not only a Uint8Array', async () => {
    const actual = await runTagInSandbox({
      pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
        var SD = require('string_decoder').StringDecoder;
        var d = new SD('utf8');
        return d.write([104, 105]);
      } }];`,
      tagName: 't',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe('hi');
  });
});
