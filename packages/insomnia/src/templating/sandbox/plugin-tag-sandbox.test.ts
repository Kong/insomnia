import nodeCrypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { localTemplateTags } from '../../common/templating/local-template-tags';
import { createMapBridge, type HostBridge } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { SANDBOX_MODULES, TEMPLATE_TAG_BASELINE_MODULES } from './module-registry';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';

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

const envelope = (args: unknown[], grantedModules: string[] = TEMPLATE_TAG_BASELINE_MODULES): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules,
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
