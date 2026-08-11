import { format as nodeFormat, parse as nodeParse } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { HostBridge } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const envelope = (args: unknown[]): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'arm64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules: ['url'],
  grantedCapabilities: [],
});

// `run` receives (context, ...args) — the leading context arg is skipped before forwarding to
// url.parse, so callers can pass exactly the args they'd pass to node:url's parse directly. The
// result is JSON.stringify'd because parse() returns a plain object of strings/null/nested objects
// (never a function/bigint/symbol) — always JSON-transportable, unlike some of util's edge cases.
const PARSE_TAG_SOURCE =
  "module.exports.templateTags = [{ name: 'r', run: function () {" +
  ' var url = require("url");' +
  ' return JSON.stringify(url.parse.apply(url, Array.prototype.slice.call(arguments, 1)));' +
  ' } }];';

const runParse = async (...args: unknown[]) =>
  JSON.parse(
    await runTagInSandbox({ pluginSource: PARSE_TAG_SOURCE, tagName: 'r', envelope: envelope(args), bridge: noBridge }),
  );

const FORMAT_TAG_SOURCE =
  "module.exports.templateTags = [{ name: 'r', run: function () {" +
  ' var url = require("url");' +
  ' return url.format(arguments[1]);' +
  ' } }];';

const runFormat = (obj: unknown) =>
  runTagInSandbox({ pluginSource: FORMAT_TAG_SOURCE, tagName: 'r', envelope: envelope([obj]), bridge: noBridge });

describe('parse — parity with node:url.parse', () => {
  const cases: [string, boolean][] = [
    ['http://user:pass@example.com:8080/path/to/thing?a=1&b=2#frag', false],
    ['http://user:pass@example.com:8080/path/to/thing?a=1&b=2#frag', true],
    ['https://example.com/', false],
    ['https://example.com/', true],
    ['http://example.com', false],
    ['http://example.com:80/', false],
    ['http://EXAMPLE.com/PATH', false],
    ['http://', false],
    ['http:///path', false],
    ['//example.com/path?x=1', false],
    ['//example.com/path?x=1', true],
    ['/just/a/path?x=1#y', false],
    ['path/relative', false],
    ['', false],
    ['   ', false],
    ['foo:bar@baz', false],
    ['foo:bar@baz/path', false],
    ['foo:bar/path', false],
    ['foo:bar', false],
    ['foo:/bar', false],
    ['foo://bar/baz', false],
    ['http:/single/slash', false],
    ['http:no-slashes-at-all', false],
    ['urn:isbn:0-486-27557-4', false],
    ['urn:isbn:1:2:3', false],
    ['urn:1:2', false],
    ['tel:+1-800-555-0100', false],
    ['data:text/plain,hello', false],
    ['custom:foo?bar#baz', false],
    ['javascript:alert(1)', false],
    ['javascript://foo/bar', false],
    ['javascript:alert(1)?x=1#y', false],
    ['ws:no-slash', false],
    ['ws://host/path', false],
    ['gopher:no-slash', false],
    ['file:///etc/passwd', false],
    ['unknownproto://host/path', false],
    ['unknownproto:no-slash-but-colon:port123', false],
    ['http://example.com:abc/x', false],
    ['http://example.com:8080abc/x', false],
    ['http://user@host:notaport/x', false],
    ['http://example.com/a b/c?d=e f', false],
    ['http://example.com/a b/c?d=e f', true],
    ['http://example.com/a?b=1&b=2&c', true],
    ['http://[::1]:8080/path', false],
    ['http://[::1]/path', false],
    ['http://[2001:DB8::1]:443/x', false],
    ['https://[::1]:443/x', false],
    ['http://user:pass@[::1]:8080/path', false],
  ];

  it.each(cases)('parse(%j, %j) matches node:url', async (input, parseQueryString) => {
    const actual = await runParse(input, parseQueryString);
    const expected = nodeParse(input, parseQueryString);
    expect(actual).toEqual(structuredClone(expected));
  });
});

describe('parse — slashesDenoteHost', () => {
  it.each([
    ['//foo/bar', false, true],
    ['//foo/bar', false, false],
    ['foo/bar', false, true],
  ] as [string, boolean, boolean][])('parse(%j, %j, %j) matches node:url', async (input, pqs, sdh) => {
    const actual = await runParse(input, pqs, sdh);
    const expected = nodeParse(input, pqs, sdh);
    expect(actual).toEqual(structuredClone(expected));
  });
});

describe('format — parity with node:url.format', () => {
  const cases: Record<string, unknown>[] = [
    { protocol: 'http:', host: 'example.com', pathname: '/a', search: '?x=1', hash: '#y' },
    { protocol: 'http', hostname: 'example.com', port: '8080', pathname: '/a' },
    { protocol: 'http:', slashes: true, hostname: 'example.com', query: { a: '1', b: ['2', '3'] }, pathname: '/a' },
    { protocol: 'mailto:', auth: 'foo', host: 'example.com', slashes: false },
    { pathname: '/just/path', search: '?x=1' },
    { host: 'example.com', pathname: '/a' },
    { protocol: 'https:', hostname: 'EXAMPLE.com', pathname: '/A' },
  ];

  it.each(cases)('format(%j) matches node:url', async obj => {
    const actual = await runFormat(obj);
    expect(actual).toBe(nodeFormat(obj));
  });

  it('format(string) round-trips through parse, matching node:url', async () => {
    const input = 'http://user:pass@example.com:8080/a/b?x=1#y';
    const actual = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'r', run: function () { return require('url').format(arguments[1]); } }];",
      tagName: 'r',
      envelope: envelope([input]),
      bridge: noBridge,
    });
    expect(actual).toBe(nodeFormat(input));
  });

  it('format(parse(url)) round-trips, matching node:url, across every parse case', async () => {
    const inputs = ['http://user:pass@example.com:8080/a?b=1#c', 'http://[::1]:8080/path', 'mailto:foo@example.com'];
    for (const input of inputs) {
      const parsed = await runParse(input, false);
      const actual = await runFormat(parsed);
      expect(actual).toBe(nodeFormat(nodeParse(input, false)));
    }
  });
});

describe('URL / URLSearchParams passthrough', () => {
  it('require("url").URL is the same constructor as the ambient URL global', async () => {
    const actual = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'r', run: function () { return String(require('url').URL === URL); } }];",
      tagName: 'r',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe('true');
  });

  it('require("url").URLSearchParams is the same constructor as the ambient URLSearchParams global', async () => {
    const actual = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'r', run: function () { return String(require('url').URLSearchParams === URLSearchParams); } }];",
      tagName: 'r',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe('true');
  });

  it('require("url").URL is usable directly (not just identity-equal)', async () => {
    const actual = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'r', run: function () { var U = require('url').URL; return new U('https://h/p?a=1').hostname; } }];",
      tagName: 'r',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe('h');
  });
});

describe('documented divergences from real node:url', () => {
  it('does not treat a backslash as a path/host delimiter or as a "//" stand-in (intentional divergence)', async () => {
    const input = 'http://good.com\\@evil.com/x';
    const actual = await runParse(input, false);
    // Real node:url treats "\" as "/", terminating the host at "good.com" and reinterpreting the
    // rest as path — exactly the parsing-confusion behavior its own deprecation notice warns about.
    expect(nodeParse(input, false).hostname).toBe('good.com');
    // This sandbox's parser leaves the backslash as an ordinary character: it's not a delimiter, so
    // auth/host splitting proceeds on "@" alone, landing on a different (but internally consistent
    // and predictable) result.
    expect(actual.hostname).toBe('evil.com');
    expect(actual.auth).toBe('good.com\\');
  });

  it('does not treat "\\\\" after the protocol as equivalent to "//"', async () => {
    const input = 'http:\\\\evil.com\\x';
    const actual = await runParse(input, false);
    expect(nodeParse(input, false).host).toBe('evil.com');
    expect(actual.slashes).toBeNull();
    expect(actual.host).toBeNull();
  });
});

describe('leading/trailing C0-control-or-space characters', () => {
  it('a leading control character before a scheme does not prevent protocol detection', async () => {
    const input = String.fromCodePoint(0) + 'javascript:alert(1)';
    const actual = await runParse(input, false);
    // node:url strips leading/trailing C0-control-or-space characters (matching the WHATWG URL
    // Standard's own input-trimming step) before parsing, so a leading NUL byte doesn't hide the
    // scheme from it.
    expect(nodeParse(input, false).protocol).toBe('javascript:');
    expect(actual.protocol).toBe('javascript:');
  });

  it('a trailing control character does not survive into the parsed pathname', async () => {
    const input = 'http://host/path' + String.fromCodePoint(31);
    const actual = await runParse(input, false);
    expect(nodeParse(input, false).pathname).toBe('/path');
    expect(actual.pathname).toBe('/path');
  });
});

describe('unsafe-character escaping table', () => {
  it('escapes a literal single quote, matching node:url', async () => {
    const input = "http://host/a'b";
    const actual = await runParse(input, false);
    expect(nodeParse(input, false).pathname).toBe('/a%27b');
    expect(actual.pathname).toBe('/a%27b');
  });
});
