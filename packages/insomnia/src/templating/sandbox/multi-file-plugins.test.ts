import nodeCrypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';

// Multi-file plugin support (M4): the plugin's own files travel in the envelope's moduleFiles map,
// and the in-sandbox loader resolves relative require()s against it while bare specifiers still hit
// the grant-gated registry. These tests drive that loader directly with hand-built maps (the host
// walker that produces the map is tested in main/__tests__/templating-worker-database.test.ts).
const nodeHostCrypto: HostCrypto = {
  hash: (a, d, i, o) =>
    nodeCrypto
      .createHash(a)
      .update(d, i as nodeCrypto.Encoding)
      .digest(o as nodeCrypto.BinaryToTextEncoding),
  hmac: (a, k, d, o) =>
    nodeCrypto
      .createHmac(a, k)
      .update(d, 'utf8')
      .digest(o as nodeCrypto.BinaryToTextEncoding),
  randomBytes: n => nodeCrypto.randomBytes(n).toString('base64'),
  randomUUID: () => nodeCrypto.randomUUID(),
};

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const envelope = (
  moduleFiles: Record<string, string>,
  entryModuleKey = 'index.js',
  grantedModules: string[] = ['path', 'crypto'],
): ContextEnvelope => ({
  args: [],
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules,
  grantedCapabilities: [],
  moduleFiles,
  entryModuleKey,
});

const runMap = (moduleFiles: Record<string, string>, grantedModules?: string[]) =>
  runTagInSandbox({
    tagName: 't',
    envelope: envelope(moduleFiles, 'index.js', grantedModules),
    bridge: noBridge,
    hostCrypto: nodeHostCrypto,
  });

describe('multi-file plugins (M4)', () => {
  it('resolves relative requires across files and nested directories', async () => {
    const actual = await runMap({
      'index.js': `
        var util = require('./util');
        var helper = require('./nested/helper');
        module.exports.templateTags = [{ name: 't', run: function () { return util.a() + '+' + helper.b(); } }];`,
      'util.js': "module.exports.a = function () { return 'util-a'; };",
      'nested/helper.js':
        "var deep = require('../util'); module.exports.b = function () { return 'helper-' + deep.a(); };",
    });
    expect(actual).toBe('util-a+helper-util-a');
  });

  it('resolves a directory import to its index.js', async () => {
    const actual = await runMap({
      'index.js':
        "var lib = require('./lib'); module.exports.templateTags = [{ name: 't', run: function () { return lib.v; } }];",
      'lib/index.js': "module.exports.v = 'from-lib-index';",
    });
    expect(actual).toBe('from-lib-index');
  });

  it('bundles relative files in but still routes a bare require to the registry (hybrid)', async () => {
    const actual = await runMap(
      {
        'index.js': `
          var makeId = require('./make-id');
          module.exports.templateTags = [{ name: 't', run: function () { return makeId(); } }];`,
        'make-id.js':
          "var uuid = require('uuid'); module.exports = function () { return uuid.validate(uuid.v4()) ? 'id-ok' : 'id-bad'; };",
      },
      ['path', 'crypto', 'uuid'],
    );
    expect(actual).toBe('id-ok');
  });

  it('shares module state — a relative module is evaluated once (CommonJS cache)', async () => {
    const actual = await runMap({
      'index.js': `
        var a = require('./counter'); var b = require('./counter');
        a.inc(); b.inc();
        module.exports.templateTags = [{ name: 't', run: function () { return String(require('./counter').value); } }];`,
      'counter.js': 'module.exports.value = 0; module.exports.inc = function () { module.exports.value++; };',
    });
    expect(actual).toBe('2');
  });

  it('throws Cannot find module for an unresolvable relative import', async () => {
    await expect(
      runMap({
        'index.js':
          "require('./missing'); module.exports.templateTags = [{ name: 't', run: function () { return 'x'; } }];",
      }),
    ).rejects.toThrow(/Cannot find module '\.\/missing'/);
  });

  it('does not clamp an above-root traversal back into the plugin (treats it as unresolvable)', async () => {
    // nested/deep/leaf reaches three levels up — above the plugin root. A util.js exists at the root,
    // but the escaping specifier must NOT resolve to it (Node would look outside the plugin). Clamping
    // `..` at the root would let an out-of-plugin path masquerade as an in-plugin module.
    await expect(
      runMap({
        'index.js':
          "require('./nested/deep/leaf'); module.exports.templateTags = [{ name: 't', run: function () { return 'x'; } }];",
        'nested/deep/leaf.js': "module.exports = require('../../../util');",
        'util.js': "module.exports = 'root-util';",
      }),
    ).rejects.toThrow(/Cannot find module '\.\.\/\.\.\/\.\.\/util'/);
  });

  it('propagates a syntax error in a required relative file (broken plugin)', async () => {
    await expect(
      runMap({
        'index.js':
          "require('./broken'); module.exports.templateTags = [{ name: 't', run: function () { return 'x'; } }];",
        'broken.js': 'module.exports = function ( { syntax error here',
      }),
    ).rejects.toThrow();
  });

  it('a poisoned map key cannot shadow a bare registry module (bare never hits relative map)', async () => {
    // Even if the map contained a "uuid.js", a BARE require('uuid') resolves via the registry, not
    // the map — only relative specifiers consult moduleFiles. (The host walker also excludes
    // node_modules entirely, so this key never exists in practice.)
    const actual = await runMap(
      {
        'index.js':
          "var uuid = require('uuid'); module.exports.templateTags = [{ name: 't', run: function () { return uuid.validate(uuid.v4()) ? 'real-uuid' : 'bad'; } }];",
        'uuid.js': "module.exports = { v4: function () { return 'evil'; }, validate: function () { return true; } };",
      },
      ['path', 'crypto', 'uuid'],
    );
    expect(actual).toBe('real-uuid');
  });

  // Guards against `in` matching an inherited Object.prototype member instead of failing closed.
  describe('does not resolve a nonexistent relative specifier that shadows an Object.prototype member', () => {
    it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString'])(
      'require("./%s") with no such file throws Cannot find module',
      async name => {
        await expect(
          runMap({
            'index.js':
              `require('./${name}'); module.exports.templateTags = [{ name: 't', run: function () { return 'x'; } }];`,
          }),
        ).rejects.toThrow(new RegExp(`Cannot find module '\\./${name}'`));
      },
    );
  });

  it('still resolves a real file whose name happens to match an Object.prototype member', async () => {
    const actual = await runMap({
      'index.js':
        "var c = require('./constructor'); module.exports.templateTags = [{ name: 't', run: function () { return c.v; } }];",
      'constructor.js': "module.exports.v = 'real-constructor-file';",
    });
    expect(actual).toBe('real-constructor-file');
  });
});
