import nodeCrypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { localTemplateTags } from '../../common/templating/local-template-tags';
import {
  ALL_CAPABILITIES,
  BRIDGE_PATH_CAPABILITIES,
  createMapBridge,
  filterByCapabilities,
  type HostBridge,
  TEMPLATE_TAG_BASELINE_CAPABILITIES,
} from './host-bridge';
import { IN_SANDBOX_BOOTSTRAP } from './in-sandbox-bootstrap';
import type { ContextEnvelope } from './marshal';
import { SANDBOX_MODULES, TEMPLATE_TAG_BASELINE_MODULES } from './module-registry';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';
import { resolveTemplateTagCapabilities, resolveTemplateTagModules } from './surface-profiles';

// Real node:crypto-backed host crypto, identical to what main provides.
const nodeHostCrypto: HostCrypto = {
  hash: (algo, data, inputEncoding, outputEncoding) =>
    nodeCrypto
      .createHash(algo)
      .update(data, inputEncoding as nodeCrypto.Encoding)
      .digest(outputEncoding as nodeCrypto.BinaryToTextEncoding),
  hmac: (algo, key, data, outputEncoding) =>
    nodeCrypto
      .createHmac(algo, key)
      .update(data, 'utf8')
      .digest(outputEncoding as nodeCrypto.BinaryToTextEncoding),
  randomBytes: size => nodeCrypto.randomBytes(size).toString('base64'),
  randomUUID: () => nodeCrypto.randomUUID(),
};

// The real in-process tag run, used to compute the expected (parity) output. We do NOT feed its
// .toString() into the sandbox: under Vitest, Vite SSR rewrites module imports (e.g. `invariant`
// -> `__vite_ssr_import_n__.invariant`), which don't exist in the sandbox. Real plugins are loaded
// as untransformed file text, so the fixtures below are plain CJS source — exactly that shape.
const tagRun = (name: string) => {
  const found = localTemplateTags.find(t => t.templateTag.name === name);
  if (!found) {
    throw new Error(`local tag ${name} not found`);
  }
  return found.templateTag.run;
};

// Self-contained CJS source mirroring the real `base64` local tag logic (with a local `invariant`).
const BASE64_PLUGIN_SOURCE = `
function invariant(cond, msg) { if (!cond) { throw new Error(msg); } }
module.exports.templateTags = [{
  name: 'base64',
  run: function (_context, action, kind, text) {
    if (text === undefined) { text = ''; }
    invariant(action === 'encode' || action === 'decode', 'invalid action');
    invariant(kind === 'normal' || kind === 'url' || kind === 'hex', 'invalid kind');
    if (action === 'encode') {
      if (kind === 'normal') { return btoa(new TextEncoder().encode(text).reduce(function (d, b) { return d + String.fromCodePoint(b); }, '')); }
      if (kind === 'hex') { var hb = new Uint8Array(text.match(/.{1,2}/g).map(function (byte) { return Number.parseInt(byte, 16); })); return btoa(String.fromCodePoint.apply(String, [].slice.call(hb))); }
      if (kind === 'url') { var b64 = btoa(new TextEncoder().encode(text).reduce(function (d, b) { return d + String.fromCodePoint(b); }, '')); return b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); }
    }
    var binary = atob(text);
    var bytes = new Uint8Array([].slice.call(binary).map(function (ch) { return (ch && ch.codePointAt(0)) || 0; }));
    if (kind === 'hex') { return [].slice.call(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
    return new TextDecoder().decode(bytes);
  }
}];`;

// Self-contained CJS source mirroring the real `os` local tag logic.
const OS_PLUGIN_SOURCE = `
module.exports.templateTags = [{
  name: 'os',
  run: async function (context, fnName) {
    var os = await context.util.nodeOS();
    var value = os[fnName];
    if (typeof value !== 'string') { return JSON.stringify(value); }
    return value;
  }
}];`;

const envelope = (
  args: unknown[],
  grantedModules: string[] = TEMPLATE_TAG_BASELINE_MODULES,
  grantedCapabilities: string[] = ALL_CAPABILITIES,
): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'arm64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules,
  grantedCapabilities,
});

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

describe('runTagInSandbox — PoC milestone 1', () => {
  // (a) Pure compute, no bridge: base64 exercises the btoa/atob/TextEncoder/TextDecoder polyfills
  // QuickJS lacks. Sandbox output must match the real in-process run exactly.
  describe('base64 parity (pure compute)', () => {
    const cases: [string, string, string][] = [
      ['encode', 'normal', 'hi there 👋'],
      ['encode', 'url', 'hi there?&=/+'],
      ['encode', 'hex', '48656c6c6f'],
      ['decode', 'normal', 'aGVsbG8gd29ybGQ='],
      ['decode', 'hex', 'SGVsbG8='],
    ];

    it.each(cases)('base64 %s/%s', async (action, kind, text) => {
      const expected = String(await Promise.resolve(tagRun('base64')({} as any, action, kind, text)));
      const actual = await runTagInSandbox({
        pluginSource: BASE64_PLUGIN_SOURCE,
        tagName: 'base64',
        envelope: envelope([action, kind, text]),
        bridge: noBridge,
      });
      expect(actual).toBe(expected);
    });
  });

  // (b) One async bridge: os awaits context.util.nodeOS(), proving the
  // __hostBridge -> handler -> VM-promise -> executePendingJobs interleave works end-to-end.
  describe('os tag (async bridge round-trip)', () => {
    const nodeOSResult = {
      arch: 'x64',
      platform: 'linux',
      release: '6.0.0',
      cpus: [{ model: 'test-cpu' }, { model: 'test-cpu' }],
      hostname: 'test-host',
      freemem: 1024,
      userInfo: { username: 'tester', uid: 1000 },
    };
    const bridge = createMapBridge({ nodeOS: async () => nodeOSResult });

    const runInProcess = (fnName: string) =>
      tagRun('os')({ util: { nodeOS: async () => nodeOSResult } } as any, fnName);

    it.each(['platform', 'arch', 'hostname', 'cpus', 'userInfo'])('os %s', async fnName => {
      const expected = String(await runInProcess(fnName));
      const actual = await runTagInSandbox({
        pluginSource: OS_PLUGIN_SOURCE,
        tagName: 'os',
        envelope: envelope([fnName]),
        bridge,
      });
      expect(actual).toBe(expected);
    });
  });

  // (c) require('crypto') backed by sync host functions — proves the most common plugin dependency
  // works end-to-end and matches node:crypto exactly.
  describe('require("crypto") parity', () => {
    const cryptoTag = (body: string) =>
      `module.exports.templateTags = [{ name: 'c', run: function (context, input) { const crypto = require('crypto'); ${body} } }];`;

    it.each(['sha256', 'md5', 'sha1', 'sha512'])('createHash %s hex', async algo => {
      const source = cryptoTag(`return crypto.createHash('${algo}').update(input).digest('hex');`);
      const expected = nodeCrypto.createHash(algo).update('hello world', 'utf8').digest('hex');
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope(['hello world']),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(actual).toBe(expected);
    });

    it('createHash sha256 base64 + chained updates', async () => {
      const source = cryptoTag("return crypto.createHash('sha256').update('foo').update(input).digest('base64');");
      const expected = nodeCrypto.createHash('sha256').update('foo').update('bar').digest('base64');
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope(['bar']),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(actual).toBe(expected);
    });

    it('createHmac sha256 hex', async () => {
      const source = cryptoTag("return crypto.createHmac('sha256', 'parity-test-key').update(input).digest('hex');");
      // The key is a parity-test vector, not a credential.
      const expected = nodeCrypto.createHmac('sha256', 'parity-test-key').update('payload', 'utf8').digest('hex'); // nosemgrep: javascript.lang.security.audit.hardcoded-hmac-key.hardcoded-hmac-key
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope(['payload']),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(actual).toBe(expected);
    });

    it('randomUUID has v4 shape', async () => {
      const source = cryptoTag('return crypto.randomUUID();');
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope([]),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(actual).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('randomBytes(16).toString("hex") is 32 hex chars', async () => {
      const source = cryptoTag("return crypto.randomBytes(16).toString('hex');");
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope([]),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(actual).toMatch(/^[0-9a-f]{32}$/);
    });

    it('clamps an oversized randomBytes request instead of allocating it', async () => {
      const source = cryptoTag("return crypto.randomBytes(2147483648).toString('hex').length;");
      const actual = await runTagInSandbox({
        pluginSource: source,
        tagName: 'c',
        envelope: envelope([]),
        bridge: noBridge,
        hostCrypto: nodeHostCrypto,
      });
      expect(Number(actual)).toBeLessThanOrEqual(65_536 * 2);
    });

    it('throws a clear error when crypto is not provided', async () => {
      const source = cryptoTag("return crypto.createHash('sha256').update(input).digest('hex');");
      await expect(
        runTagInSandbox({ pluginSource: source, tagName: 'c', envelope: envelope(['x']), bridge: noBridge }),
      ).rejects.toThrow(/crypto.*not available|Cannot find module/);
    });
  });

  it('propagates a thrown tag error as a real Error', async () => {
    const source = 'module.exports.templateTags = [{ name: "boom", run: function () { throw new Error("kaboom"); } }];';
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'boom', envelope: envelope([]), bridge: noBridge }),
    ).rejects.toThrow('kaboom');
  });

  it('surfaces a host bridge failure inside the tag', async () => {
    const source =
      'module.exports.templateTags = [{ name: "needsOs", run: async function (ctx) { return await ctx.util.nodeOS(); } }];';
    const failing = createMapBridge({
      nodeOS: async () => {
        throw new Error('bridge exploded');
      },
    });
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'needsOs', envelope: envelope([]), bridge: failing }),
    ).rejects.toThrow('bridge exploded');
  });

  it('times out a synchronous infinite loop instead of hanging', async () => {
    const source = 'module.exports.templateTags = [{ name: "spin", run: function () { while (true) {} } }];';
    const start = Date.now();
    await expect(
      runTagInSandbox({
        pluginSource: source,
        tagName: 'spin',
        envelope: envelope([]),
        bridge: noBridge,
        timeoutMs: 200,
      }),
    ).rejects.toThrow(/interrupted|timed out/i);
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('rejects unbounded allocation instead of exhausting host memory', async () => {
    const source = `module.exports.templateTags = [{ name: "hog", run: function () {
      var chunks = [];
      var big = new Array(1 << 20).join("x");
      while (true) { chunks.push(big); }
    } }];`;
    const start = Date.now();
    // A generous timeoutMs that's far longer than hitting the 32MB memory limit should take, so a
    // pass here can only be explained by the memory limit firing, not the wall-clock timeout.
    await expect(
      runTagInSandbox({
        pluginSource: source,
        tagName: 'hog',
        envelope: envelope([]),
        bridge: noBridge,
        timeoutMs: 30_000,
      }),
    ).rejects.toThrow(/memory/i);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe('module registry gating (M1)', () => {
  const requireTag = (mod: string) =>
    `module.exports.templateTags = [{ name: 'r', run: function () { var m = require('${mod}'); return typeof m; } }];`;

  it('baseline grant only names registered modules', () => {
    const registered = SANDBOX_MODULES.map(m => m.name);
    for (const name of TEMPLATE_TAG_BASELINE_MODULES) {
      expect(registered).toContain(name);
    }
  });

  it('resolves a granted, registered module through the registry', async () => {
    const source =
      "module.exports.templateTags = [{ name: 'r', run: function () { return require('path').join('a', 'b'); } }];";
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([], ['path']),
      bridge: noBridge,
    });
    expect(actual).toBe('a/b');
  });

  it('resolves node:-prefixed aliases against the canonical grant', async () => {
    const source =
      "module.exports.templateTags = [{ name: 'r', run: function () { return require('node:path').join('a', 'b'); } }];";
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([], ['path']),
      bridge: noBridge,
    });
    expect(actual).toBe('a/b');
  });

  it.each(['left-pad', 'fs', 'child_process', 'process'])(
    'denies ungranted module %s with the manifest message',
    async mod => {
      await expect(
        runTagInSandbox({ pluginSource: requireTag(mod), tagName: 'r', envelope: envelope([]), bridge: noBridge }),
      ).rejects.toThrow(`Module '${mod}' not permitted by manifest`);
    },
  );

  it('denies even baseline modules when the grant set is empty (default-deny)', async () => {
    await expect(
      runTagInSandbox({ pluginSource: requireTag('path'), tagName: 'r', envelope: envelope([], []), bridge: noBridge }),
    ).rejects.toThrow("Module 'path' not permitted by manifest");
  });

  it('distinguishes granted-but-unregistered with the availability message', async () => {
    await expect(
      runTagInSandbox({
        pluginSource: requireTag('left-pad'),
        tagName: 'r',
        envelope: envelope([], ['left-pad']),
        bridge: noBridge,
      }),
    ).rejects.toThrow("Module 'left-pad' not available in sandbox");
  });

  it('caches module exports — repeated require returns the same object', async () => {
    const source =
      "module.exports.templateTags = [{ name: 'r', run: function () { return String(require('path') === require('path')); } }];";
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([], ['path']),
      bridge: noBridge,
    });
    expect(actual).toBe('true');
  });

  it('denies a top-level require at plugin-module evaluation time', async () => {
    const source =
      "var fs = require('fs');\nmodule.exports.templateTags = [{ name: 'r', run: function () { return 'unreachable'; } }];";
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'r', envelope: envelope([]), bridge: noBridge }),
    ).rejects.toThrow("Module 'fs' not permitted by manifest");
  });

  it('treats prototype-chain names as ordinary ungranted modules', async () => {
    await expect(
      runTagInSandbox({
        pluginSource: requireTag('__proto__'),
        tagName: 'r',
        envelope: envelope([]),
        bridge: noBridge,
      }),
    ).rejects.toThrow("Module '__proto__' not permitted by manifest");
  });

  it('ignores plugin tampering with __envelopeJSON — grants are captured before plugin eval', async () => {
    const forged = JSON.stringify({ ...envelope([]), grantedModules: ['fs', 'path', 'crypto'] });
    const source = [
      `globalThis.__envelopeJSON = ${JSON.stringify(forged)};`,
      'module.exports.templateTags = [{ name: "r", run: function () { try { require("fs"); return "escaped"; } catch (e) { return e.message; } } }];',
    ].join('\n');
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe("Module 'fs' not permitted by manifest");
  });

  it('keeps the grant check working when a plugin poisons Array.prototype.indexOf', async () => {
    // The gate captures a pristine indexOf before plugin code runs, so overriding the intrinsic to
    // never return -1 must not let an ungranted module through.
    const source = [
      'Array.prototype.indexOf = function () { return 0; };',
      'module.exports.templateTags = [{ name: "r", run: function () { try { require("crypto"); return "escaped"; } catch (e) { return e.message; } } }];',
    ].join('\n');
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([], ['path']),
      bridge: noBridge,
    });
    expect(actual).toBe("Module 'crypto' not permitted by manifest");
  });

  it('locks __require so a plugin cannot replace the gate', async () => {
    // __require is pinned non-writable after the bootstrap; reassigning it throws in strict mode,
    // so a plugin cannot swap in a permissive resolver.
    const source = [
      'try { globalThis.__require = function () { return {}; }; } catch (e) {}',
      'module.exports.templateTags = [{ name: "r", run: function () { try { require("fs"); return "escaped"; } catch (e) { return e.message; } } }];',
    ].join('\n');
    const actual = await runTagInSandbox({
      pluginSource: source,
      tagName: 'r',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(actual).toBe("Module 'fs' not permitted by manifest");
  });
});

describe('manifest-declared module grants (C3)', () => {
  const eventsTag =
    "module.exports.templateTags = [{ name: 'r', run: function () { var E = require('events').EventEmitter; var e = new E(); var out = ''; e.on('x', function (v) { out = v; }); e.emit('x', 'fired'); return out; } }];";

  it('resolveTemplateTagModules unions the baseline with declared modules', () => {
    expect(resolveTemplateTagModules(['events'])).toEqual([...TEMPLATE_TAG_BASELINE_MODULES, 'events']);
    expect(resolveTemplateTagModules()).toEqual(TEMPLATE_TAG_BASELINE_MODULES);
    // Declaring a baseline module doesn't duplicate it.
    expect(resolveTemplateTagModules(['path'])).toEqual(TEMPLATE_TAG_BASELINE_MODULES);
  });

  it('canonicalizes declared aliases so the node:-prefixed form grants the module', () => {
    expect(resolveTemplateTagModules(['node:events'])).toEqual([...TEMPLATE_TAG_BASELINE_MODULES, 'events']);
    // node:crypto resolves to the already-baseline crypto without duplicating it.
    expect(resolveTemplateTagModules(['node:crypto'])).toEqual(TEMPLATE_TAG_BASELINE_MODULES);
  });

  it('a plugin declaring the node:events alias can use EventEmitter', async () => {
    const actual = await runTagInSandbox({
      pluginSource: eventsTag,
      tagName: 'r',
      envelope: envelope([], resolveTemplateTagModules(['node:events'])),
      bridge: noBridge,
    });
    expect(actual).toBe('fired');
  });

  it('a plugin granted "events" can use EventEmitter', async () => {
    const actual = await runTagInSandbox({
      pluginSource: eventsTag,
      tagName: 'r',
      envelope: envelope([], resolveTemplateTagModules(['events'])),
      bridge: noBridge,
    });
    expect(actual).toBe('fired');
  });

  it('a plugin without the grant is denied "events" with the manifest message', async () => {
    await expect(
      runTagInSandbox({
        pluginSource: eventsTag,
        tagName: 'r',
        envelope: envelope([], resolveTemplateTagModules()),
        bridge: noBridge,
      }),
    ).rejects.toThrow("Module 'events' not permitted by manifest");
  });

  const querystringTag =
    "module.exports.templateTags = [{ name: 'r', run: function () { var qs = require('querystring'); return JSON.stringify(qs.parse('a=1&a=2')); } }];";

  it('a plugin granted "querystring" can use it', async () => {
    const actual = await runTagInSandbox({
      pluginSource: querystringTag,
      tagName: 'r',
      envelope: envelope([], resolveTemplateTagModules(['querystring'])),
      bridge: noBridge,
    });
    expect(JSON.parse(actual)).toEqual({ a: ['1', '2'] });
  });

  it('a plugin declaring the node:querystring alias can use it', async () => {
    const actual = await runTagInSandbox({
      pluginSource: querystringTag,
      tagName: 'r',
      envelope: envelope([], resolveTemplateTagModules(['node:querystring'])),
      bridge: noBridge,
    });
    expect(JSON.parse(actual)).toEqual({ a: ['1', '2'] });
  });

  it('a plugin without the grant is denied "querystring" with the manifest message', async () => {
    await expect(
      runTagInSandbox({
        pluginSource: querystringTag,
        tagName: 'r',
        envelope: envelope([], resolveTemplateTagModules()),
        bridge: noBridge,
      }),
    ).rejects.toThrow("Module 'querystring' not permitted by manifest");
  });
});

describe('ambient globals — sandbox stdlib (M2)', () => {
  // Run a plugin `run` body and return its string result. `body` is always a constant literal at
  // the call sites; dynamic values are passed as tag args (data via the envelope, read as
  // arguments[1..] inside the tag) rather than interpolated into the source — so no test value is
  // ever concatenated into eval'd code. Globals are ungated, so the grant set is irrelevant;
  // crypto-backed globals need hostCrypto, passed here to match the main-process path.
  const runGlobal = (body: string, args: unknown[] = []) =>
    runTagInSandbox({
      pluginSource: `module.exports.templateTags = [{ name: 'g', run: function (context) { ${body} } }];`,
      tagName: 'g',
      envelope: envelope(args),
      bridge: noBridge,
      hostCrypto: nodeHostCrypto,
    });

  describe('Buffer parity vs node:Buffer', () => {
    it.each([
      ['utf8', 'hi there 👋'],
      ['base64', 'hi there 👋'],
      ['hex', 'hi there 👋'],
      ['latin1', 'hello'],
    ])('Buffer.from(str).toString(%s)', async (enc, input) => {
      const actual = await runGlobal('return Buffer.from(arguments[1]).toString(arguments[2]);', [input, enc]);
      expect(actual).toBe(Buffer.from(input).toString(enc as BufferEncoding));
    });

    it('round-trips base64 back to utf8', async () => {
      const b64 = Buffer.from('round trip').toString('base64');
      const actual = await runGlobal("return Buffer.from(arguments[1], 'base64').toString('utf8');", [b64]);
      expect(actual).toBe('round trip');
    });

    it('Buffer.concat + isBuffer', async () => {
      const actual = await runGlobal(
        "var a = Buffer.from('ab'); var b = Buffer.from('cd'); var c = Buffer.concat([a, b]); return c.toString('utf8') + ':' + Buffer.isBuffer(c) + ':' + Buffer.isBuffer('x');",
      );
      expect(actual).toBe('abcd:true:false');
    });
  });

  describe('process stub', () => {
    it('exposes the host platform from the envelope', async () => {
      // envelope() sets appInfo.platform = 'linux'
      expect(await runGlobal('return process.platform;')).toBe('linux');
    });

    it('exposes the host arch from the envelope', async () => {
      // envelope() sets appInfo.arch = 'arm64'; the stub must mirror it (not fall back to "unknown")
      expect(await runGlobal('return process.arch;')).toBe('arm64');
    });

    it('has a frozen, empty env (no host environment leak)', async () => {
      expect(await runGlobal('return JSON.stringify(process.env);')).toBe('{}');
      expect(await runGlobal('return String(Object.isFrozen(process.env));')).toBe('true');
    });

    it('is frozen', async () => {
      expect(await runGlobal('return String(Object.isFrozen(process));')).toBe('true');
    });

    it('nextTick schedules a microtask', async () => {
      expect(
        await runGlobal(
          "return new Promise(function (resolve) { process.nextTick(function (v) { resolve(v); }, 'ticked'); });",
        ),
      ).toBe('ticked');
    });
  });

  describe('crypto (Web Crypto subset)', () => {
    it('getRandomValues fills the array and returns it', async () => {
      const actual = await runGlobal(
        'var a = new Uint8Array(16); var r = crypto.getRandomValues(a); var nonZero = 0; for (var i = 0; i < a.length; i++) { if (a[i] !== 0) { nonZero++; } } return (r === a) + ":" + a.length + ":" + (nonZero > 0);',
      );
      expect(actual).toBe('true:16:true');
    });

    it('getRandomValues throws past the 65536-byte quota instead of zero-filling the tail', async () => {
      // The host clamps __cryptoRandomBytes to 65536; without the quota guard a larger request would
      // silently leave the tail zero (predictable). Match WebCrypto: throw QuotaExceededError.
      await expect(runGlobal('return crypto.getRandomValues(new Uint8Array(65537));')).rejects.toThrow(
        /exceeds the number of bytes of entropy/,
      );
    });

    it('subtle.digest SHA-256 matches node:crypto', async () => {
      const actual = await runGlobal(
        "var data = new TextEncoder().encode('insomnia'); return crypto.subtle.digest('SHA-256', data).then(function (buf) { var b = new Uint8Array(buf); var h = ''; for (var i = 0; i < b.length; i++) { h += ('0' + b[i].toString(16)).slice(-2); } return h; });",
      );
      expect(actual).toBe(nodeCrypto.createHash('sha256').update('insomnia').digest('hex'));
    });

    it('randomUUID returns a v4 UUID (host-backed, matches node:crypto shape)', async () => {
      const actual = await runGlobal('return crypto.randomUUID();');
      expect(actual).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('URL', () => {
    it('parses the common parts of an absolute URL', async () => {
      const u = 'https://user:pw@example.com:8443/a/b?x=1&y=2#frag';
      const actual = await runGlobal(
        "var u = new URL(arguments[1]); return [u.protocol, u.hostname, u.port, u.pathname, u.search, u.hash, u.origin].join('|');",
        [u],
      );
      const expected = new URL(u);
      expect(actual).toBe(
        [
          expected.protocol,
          expected.hostname,
          expected.port,
          expected.pathname,
          expected.search,
          expected.hash,
          expected.origin,
        ].join('|'),
      );
    });

    it('drops the default port like WHATWG', async () => {
      const actual = await runGlobal("var u = new URL('https://example.com:443/x'); return u.host + '|' + u.port;");
      expect(actual).toBe('example.com|');
    });

    it('exposes searchParams', async () => {
      const actual = await runGlobal("return new URL('https://h/p?a=1&a=2&b=3').searchParams.getAll('a').join(',');");
      expect(actual).toBe('1,2');
    });
  });

  describe('sandbox identity marker', () => {
    it('exposes a non-writable INSOMNIA_TEMPLATE_SANDBOX global', async () => {
      expect(await runGlobal('return String(INSOMNIA_TEMPLATE_SANDBOX);')).toBe('true');
    });

    it('cannot be spoofed away by plugin code', async () => {
      // Non-writable: a reassignment throws in strict mode / is a no-op — the marker survives.
      expect(
        await runGlobal(
          'try { INSOMNIA_TEMPLATE_SANDBOX = false; } catch (e) {} return String(INSOMNIA_TEMPLATE_SANDBOX);',
        ),
      ).toBe('true');
    });
  });

  describe('URLSearchParams', () => {
    it('parses, reads, and serializes', async () => {
      const actual = await runGlobal(
        "var p = new URLSearchParams('a=1&b=two&a=3'); return p.get('a') + '|' + p.getAll('a').join(',') + '|' + p.has('b') + '|' + p.toString();",
      );
      expect(actual).toBe('1|1,3|true|a=1&b=two&a=3');
    });

    it('encodes spaces as + and set replaces', async () => {
      const actual = await runGlobal(
        "var p = new URLSearchParams(); p.append('q', 'a b'); p.set('q', 'c d'); return p.toString();",
      );
      expect(actual).toBe('q=c+d');
      // Parity: our '+'-encoding round-trips through node's URLSearchParams.
      expect(new URLSearchParams(actual).get('q')).toBe('c d');
    });

    it('copy-constructs from another URLSearchParams instance', async () => {
      const actual = await runGlobal(
        "var a = new URLSearchParams('x=1&y=2&x=3'); var b = new URLSearchParams(a); return b.toString();",
      );
      expect(actual).toBe(new URLSearchParams(new URLSearchParams('x=1&y=2&x=3')).toString());
      expect(actual).toBe('x=1&y=2&x=3');
    });

    it('set updates the first occurrence in place and drops the rest', async () => {
      const actual = await runGlobal(
        "var p = new URLSearchParams('a=1&b=2&a=3'); p.set('a', '9'); return p.toString();",
      );
      const expected = new URLSearchParams('a=1&b=2&a=3');
      expected.set('a', '9');
      expect(actual).toBe(expected.toString());
      expect(actual).toBe('a=9&b=2');
    });
  });
});

describe('raw host bridge is not reachable from plugin code', () => {
  it('deletes __hostBridge from the sandbox global while context.* still round-trips', async () => {
    const probe = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'g', run: function () { return typeof globalThis.__hostBridge; } }];",
      tagName: 'g',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(probe).toBe('undefined');

    const bridge = createMapBridge({ nodeOS: async () => ({ arch: 'test-arch' }) });
    const viaContext = await runTagInSandbox({
      pluginSource:
        "module.exports.templateTags = [{ name: 'g', run: function (context) { return context.util.nodeOS().then(function (o) { return o.arch; }); } }];",
      tagName: 'g',
      envelope: envelope([]),
      bridge,
    });
    expect(viaContext).toBe('test-arch');
  });
});

describe('createMapBridge — resolves only registered own handlers', () => {
  it('rejects inherited Object.prototype keys instead of invoking them', async () => {
    const bridge = createMapBridge({ real: async () => 'ok' });
    expect(await bridge('real', {})).toBe('ok');
    for (const evil of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
      await expect(bridge(evil, {})).rejects.toThrow(`No host bridge handler registered for "${evil}"`);
    }
  });
});

describe('capability gating at the host bridge (C1)', () => {
  // Completeness: every bridge path the sandbox can actually call (every __bridge("…") in the
  // bootstrap) must have a capability mapping, or filterByCapabilities fails it closed. A new
  // bridge path added without a mapping fails this test.
  it('maps every sandbox-callable bridge path to a capability', () => {
    const calledPaths = new Set([...IN_SANDBOX_BOOTSTRAP.matchAll(/__bridge\("([^"]+)"/g)].map(m => m[1]));
    expect(calledPaths.size).toBeGreaterThan(0);
    for (const path of calledPaths) {
      expect(BRIDGE_PATH_CAPABILITIES, `bridge path "${path}" needs a capability mapping`).toHaveProperty(path);
    }
  });

  describe('resolveTemplateTagCapabilities', () => {
    it('defaults to the baseline floor', () => {
      expect(resolveTemplateTagCapabilities()).toEqual(TEMPLATE_TAG_BASELINE_CAPABILITIES);
    });
    it('unions declared capabilities onto the baseline without duplicating', () => {
      expect(resolveTemplateTagCapabilities(['network', 'render'])).toEqual([
        ...TEMPLATE_TAG_BASELINE_CAPABILITIES,
        'network',
      ]);
    });
  });

  describe('filterByCapabilities', () => {
    const handlers = { 'network.sendRequest': async () => 'sent', 'pluginData.getItem': async () => 'stored' };

    it('passes a granted path through to its handler', async () => {
      const filtered = filterByCapabilities(handlers, ['network']);
      await expect(filtered['network.sendRequest']({})).resolves.toBe('sent');
    });

    it('rejects an ungranted path with a message naming the capability', async () => {
      const filtered = filterByCapabilities(handlers, ['render']);
      await expect(filtered['network.sendRequest']({})).rejects.toThrow(
        "Capability 'network' not granted — add it to insomnia.permissions.capabilities",
      );
    });

    it('fails closed for a path with no capability mapping', async () => {
      const filtered = filterByCapabilities({ 'made.up.path': async () => 'x' }, ALL_CAPABILITIES);
      await expect(filtered['made.up.path']({})).rejects.toThrow(/no capability mapping/);
    });
  });

  // End-to-end through the sandbox: the gate is at the bridge, so the branch still exists in context
  // (C2 removes it) but calling it rejects unless the capability is granted.
  const runGated = (body: string, granted: string[], handlers: Record<string, (b: any) => Promise<unknown>>) =>
    runTagInSandbox({
      pluginSource: `module.exports.templateTags = [{ name: 'g', run: async function (context) { ${body} } }];`,
      tagName: 'g',
      envelope: envelope([], TEMPLATE_TAG_BASELINE_MODULES, granted),
      bridge: createMapBridge(filterByCapabilities(handlers, granted)),
    });

  it('allows a baseline util call (nodeOS) with no declared capabilities', async () => {
    const actual = await runGated(
      'var os = await context.util.nodeOS(); return os.arch;',
      [...TEMPLATE_TAG_BASELINE_CAPABILITIES],
      { nodeOS: async () => ({ arch: 'x64' }) },
    );
    expect(actual).toBe('x64');
  });

  it('the bridge rejects an ungranted capability even if the context branch is present (backstop)', async () => {
    // Defense in depth: grant `storage` to the context (so C2 keeps `context.store`) but withhold it
    // from the bridge filter. The store call reaches the bridge, which is the backstop and rejects
    // with the capability message. (The no-manifest case where the branch is simply absent is
    // covered by the C2 "omits non-baseline branches" test.)
    await expect(
      runTagInSandbox({
        pluginSource:
          "module.exports.templateTags = [{ name: 'g', run: async function (context) { return await context.store.getItem('k'); } }];",
        tagName: 'g',
        envelope: envelope([], TEMPLATE_TAG_BASELINE_MODULES, resolveTemplateTagCapabilities(['storage'])),
        bridge: createMapBridge(
          filterByCapabilities({ 'pluginData.getItem': async () => 'stored-value' }, [
            ...TEMPLATE_TAG_BASELINE_CAPABILITIES,
          ]),
        ),
      }),
    ).rejects.toThrow("Capability 'storage' not granted");
  });

  it('allows the same call once the capability is declared', async () => {
    const actual = await runGated(
      "return await context.store.getItem('k');",
      resolveTemplateTagCapabilities(['storage']),
      { 'pluginData.getItem': async () => 'stored-value' },
    );
    expect(actual).toBe('stored-value');
  });

  it('gating is per-capability, not all-or-nothing: baseline render still works when network is denied', async () => {
    const actual = await runGated('return await context.util.render("x");', [...TEMPLATE_TAG_BASELINE_CAPABILITIES], {
      'util.render': async () => 'rendered',
    });
    expect(actual).toBe('rendered');
  });
});

describe('capability-aware context construction (C2)', () => {
  // Reports the shape of the rebuilt context: which branches exist for a given capability grant.
  // No bridge is called — only `typeof` introspection — so noBridge is fine.
  const SHAPE_PROBE = `module.exports.templateTags = [{ name: 's', run: function (context) {
    return JSON.stringify({
      app: typeof context.app,
      store: typeof context.store,
      network: typeof context.network,
      render: typeof context.util.render,
      readFile: typeof context.util.readFile,
      nodeOS: typeof context.util.nodeOS,
      openInBrowser: typeof context.util.openInBrowser,
      modelsRequest: typeof context.util.models.request,
      cloudCredential: typeof context.util.models.cloudCredential,
      contextData: typeof context.context
    });
  } }];`;

  const shape = async (granted: string[]) => {
    const raw = await runTagInSandbox({
      pluginSource: SHAPE_PROBE,
      tagName: 's',
      envelope: envelope([], TEMPLATE_TAG_BASELINE_MODULES, granted),
      bridge: noBridge,
    });
    return JSON.parse(raw) as Record<string, string>;
  };

  it('omits non-baseline branches with only the baseline grant', async () => {
    const s = await shape([...TEMPLATE_TAG_BASELINE_CAPABILITIES]);
    // Baseline present:
    expect(s.render).toBe('function');
    expect(s.nodeOS).toBe('function');
    expect(s.modelsRequest).toBe('object');
    expect(s.contextData).toBe('object'); // plain data, never gated
    // Non-baseline absent:
    expect(s.app).toBe('undefined');
    expect(s.store).toBe('undefined');
    expect(s.network).toBe('undefined');
    expect(s.readFile).toBe('undefined');
    expect(s.openInBrowser).toBe('undefined');
    expect(s.cloudCredential).toBe('undefined');
  });

  it('attaches context.network / context.store exactly as declared (feature-detect matrix)', async () => {
    const none = await shape([...TEMPLATE_TAG_BASELINE_CAPABILITIES]);
    expect(`${none.network}:${none.store}`).toBe('undefined:undefined');

    const net = await shape(resolveTemplateTagCapabilities(['network']));
    expect(`${net.network}:${net.store}`).toBe('object:undefined');

    const both = await shape(resolveTemplateTagCapabilities(['network', 'storage']));
    expect(`${both.network}:${both.store}`).toBe('object:object');
  });

  it('supports graceful degradation via feature detection', async () => {
    const detect = `module.exports.templateTags = [{ name: 'd', run: function (context) {
      return context.network ? 'online-mode' : 'offline-mode';
    } }];`;
    const offline = await runTagInSandbox({
      pluginSource: detect,
      tagName: 'd',
      envelope: envelope([], TEMPLATE_TAG_BASELINE_MODULES, [...TEMPLATE_TAG_BASELINE_CAPABILITIES]),
      bridge: noBridge,
    });
    expect(offline).toBe('offline-mode');
    const online = await runTagInSandbox({
      pluginSource: detect,
      tagName: 'd',
      envelope: envelope([], TEMPLATE_TAG_BASELINE_MODULES, resolveTemplateTagCapabilities(['network'])),
      bridge: noBridge,
    });
    expect(online).toBe('online-mode');
  });

  it('attaches app + fs-read + credentials branches only when their capability is granted', async () => {
    // Capabilities passed straight into the envelope (as a bundle plugin's ALL_CAPABILITIES grant
    // would) — this tests C2's shape gating, independent of the P1 template-tag profile ceiling.
    const s = await shape([...TEMPLATE_TAG_BASELINE_CAPABILITIES, 'app', 'fs-read', 'credentials']);
    expect(s.app).toBe('object');
    expect(s.openInBrowser).toBe('function'); // openInBrowser is under the app capability
    expect(s.readFile).toBe('function');
    expect(s.cloudCredential).toBe('object');
  });

  // The two layers must never disagree: a context branch is attached iff its bridge path's
  // capability (C1's BRIDGE_PATH_CAPABILITIES) is in the envelope grant. Grant each capability
  // directly (bypassing the P1 profile) so this checks C2 shape ↔ C1 map, not profile ceilings.
  it('context shape agrees with the bridge capability map (C1 ↔ C2)', async () => {
    const branchToBridgePath: Record<string, string> = {
      network: 'network.sendRequest',
      store: 'pluginData.getItem',
      readFile: 'readFile',
      openInBrowser: 'openInBrowser',
      cloudCredential: 'cloudCredential.getById',
    };
    const baseline = await shape([...TEMPLATE_TAG_BASELINE_CAPABILITIES]);
    for (const [branch, bridgePath] of Object.entries(branchToBridgePath)) {
      const capability = BRIDGE_PATH_CAPABILITIES[bridgePath];
      expect(capability, `${bridgePath} must be a mapped bridge path`).toBeTruthy();
      // Absent under baseline (none of these capabilities are baseline)…
      expect(baseline[branch], `${branch} should be absent without ${capability}`).toBe('undefined');
      // …present once its capability is in the grant.
      const granted = await shape([...TEMPLATE_TAG_BASELINE_CAPABILITIES, capability]);
      expect(granted[branch], `${branch} should be present with ${capability}`).not.toBe('undefined');
    }
  });
});
