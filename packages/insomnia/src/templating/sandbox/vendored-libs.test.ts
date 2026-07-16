import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { buildModuleRegistrySource, VENDORED_LIB_VERSIONS } from './module-registry';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';
import { AJV_FACTORY_SOURCE } from './vendored/ajv.generated';
import { UUID_FACTORY_SOURCE } from './vendored/uuid.generated';

// Vetted vendored npm libraries (M3): registry-wiring tests only. Per-lib API-surface exercises live
// in the dedicated <name>.regression.test.ts files alongside this one — kept separate since they're
// larger and scoped to one library each.
const nodeHostCrypto: HostCrypto = {
  hash: (a, d, i, o) => nodeCrypto.createHash(a).update(d, i as nodeCrypto.Encoding).digest(o as nodeCrypto.BinaryToTextEncoding),
  hmac: (a, k, d, o) => nodeCrypto.createHmac(a, k).update(d, 'utf8').digest(o as nodeCrypto.BinaryToTextEncoding),
  randomBytes: n => nodeCrypto.randomBytes(n).toString('base64'),
  randomUUID: () => nodeCrypto.randomUUID(),
};

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

const runTag = (source: string, grantedModules: string[]) =>
  runTagInSandbox({
    pluginSource: source,
    tagName: 't',
    envelope: envelope(grantedModules),
    bridge: noBridge,
    hostCrypto: nodeHostCrypto,
  });

// The isolated, exact-pinned install's own manifest — the source of truth for what's vetted, wholly
// independent of the app's ambient node_modules (see vendored/pkg/package.json for the invariant:
// this pin must never exceed the app's own resolved version for the same lib).
const vendoredPkgJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'vendored', 'pkg', 'package.json'), 'utf8'),
) as { dependencies: Record<string, string> };

describe('vendored libraries (M3)', () => {
  it('the checked-in generated bundle matches the checked-in isolated-install pin (freshness guard)', () => {
    // Catches a hand-edited .generated.ts (or a forgotten regen after bumping vendored/pkg's pin)
    // independent of CI's regenerate-and-diff step. Anchored to the isolated pkg's own pin, not the
    // app's ambient node_modules — the sandbox is deliberately allowed to lag the app's own version.
    expect(VENDORED_LIB_VERSIONS.uuid).toBe(vendoredPkgJson.dependencies.uuid);
    expect(VENDORED_LIB_VERSIONS.ajv).toBe(vendoredPkgJson.dependencies.ajv);
  });

  it('registers a heavy lib only when granted', () => {
    expect(buildModuleRegistrySource(['path', 'crypto'])).not.toContain('__registerModule("uuid"');
    expect(buildModuleRegistrySource(['path', 'crypto', 'uuid'])).toContain('__registerModule("uuid"');
    // ajv stays out unless it too is granted.
    expect(buildModuleRegistrySource(['path', 'crypto', 'uuid'])).not.toContain('__registerModule("ajv"');
  });

  it('denies a heavy lib that was not granted with the manifest message', async () => {
    const source = "module.exports.templateTags = [{ name: 't', run: function () { return typeof require('ajv'); } }];";
    await expect(runTag(source, ['path', 'crypto'])).rejects.toThrow("Module 'ajv' not permitted by manifest");
  });

  it('stays minified (re-parsed fresh on every render, so size directly costs eval time)', () => {
    expect(AJV_FACTORY_SOURCE.length).toBeLessThan(180_000);
    expect(UUID_FACTORY_SOURCE.length).toBeLessThan(25_000);
  });
});
