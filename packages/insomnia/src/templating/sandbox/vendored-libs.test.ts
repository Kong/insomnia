import nodeCrypto from 'node:crypto';

import { version as installedAjvVersion } from 'ajv/package.json';
import { version as installedUuidVersion } from 'uuid/package.json';
import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { buildModuleRegistrySource, VENDORED_LIB_VERSIONS } from './module-registry';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';

// Vetted vendored npm libraries (M3): each is a real bundle running inside QuickJS. These smoke a
// representative API per lib — bundling can subtly break a library, so we exercise it end-to-end.
const nodeHostCrypto: HostCrypto = {
  hash: (a, d, i, o) => nodeCrypto.createHash(a).update(d, i as nodeCrypto.Encoding).digest(o as nodeCrypto.BinaryToTextEncoding),
  hmac: (a, k, d, o) => nodeCrypto.createHmac(a, k).update(d, 'utf8').digest(o as nodeCrypto.BinaryToTextEncoding),
  randomBytes: n => nodeCrypto.randomBytes(n).toString('base64'),
  randomUUID: () => nodeCrypto.randomUUID(),
};

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
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

const runTag = (source: string, grantedModules: string[]) =>
  runTagInSandbox({
    pluginSource: source,
    tagName: 't',
    envelope: envelope(grantedModules),
    bridge: noBridge,
    hostCrypto: nodeHostCrypto,
  });

describe('vendored libraries (M3)', () => {
  it('records the pinned version matching the installed dependency (regen drift guard)', () => {
    // If a dep is bumped without re-running generate:sandbox-vendored, these diverge and this fails.
    expect(VENDORED_LIB_VERSIONS.uuid).toBe(installedUuidVersion);
    expect(VENDORED_LIB_VERSIONS.ajv).toBe(installedAjvVersion);
  });

  it('registers a heavy lib only when granted', () => {
    expect(buildModuleRegistrySource(['path', 'crypto'])).not.toContain('__registerModule("uuid"');
    expect(buildModuleRegistrySource(['path', 'crypto', 'uuid'])).toContain('__registerModule("uuid"');
    // ajv stays out unless it too is granted.
    expect(buildModuleRegistrySource(['path', 'crypto', 'uuid'])).not.toContain('__registerModule("ajv"');
  });

  it('uuid.v4() returns a v4 UUID', async () => {
    const source = "module.exports.templateTags = [{ name: 't', run: function () { return require('uuid').v4(); } }];";
    const actual = await runTag(source, ['path', 'crypto', 'uuid']);
    expect(actual).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('uuid.validate agrees with a generated v4 (stateful round-trip)', async () => {
    const source = `module.exports.templateTags = [{ name: 't', run: function () {
      var uuid = require('uuid');
      var id = uuid.v4();
      return uuid.validate(id) + ':' + uuid.version(id);
    } }];`;
    expect(await runTag(source, ['path', 'crypto', 'uuid'])).toBe('true:4');
  });

  it('ajv compiles a schema and validates two payloads (exercises compiled-validator state)', async () => {
    const source = `module.exports.templateTags = [{ name: 't', run: function () {
      var Ajv = require('ajv');
      var ajv = new Ajv();
      var validate = ajv.compile({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
      return (validate({ n: 1 }) ? 'valid' : 'invalid') + ',' + (validate({ n: 'x' }) ? 'valid' : 'invalid');
    } }];`;
    expect(await runTag(source, ['path', 'crypto', 'ajv'])).toBe('valid,invalid');
  });

  it('denies a heavy lib that was not granted with the manifest message', async () => {
    const source = "module.exports.templateTags = [{ name: 't', run: function () { return typeof require('ajv'); } }];";
    await expect(runTag(source, ['path', 'crypto'])).rejects.toThrow("Module 'ajv' not permitted by manifest");
  });
});
