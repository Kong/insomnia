import nodeCrypto from 'node:crypto';

import type * as UuidModule from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { type HostBridge } from '../host-bridge';
import { type ContextEnvelope } from '../marshal';
import { type HostCrypto, runTagInSandbox } from '../plugin-tag-sandbox';

// Per-lib regression suite (M3) for the sandbox-vendored "uuid" bundle. `v4()` is non-deterministic
// by design, so it's tested for format/uniqueness only — never snapshotted for exact output.
// Deterministic functions (v3/v5, namespace-based) are checked for EXACT output, using the real npm
// `uuid` package (the app's own ambient dependency, via vi.importActual to bypass this repo's global
// `vi.mock('uuid', ...)` in setup-vitest.ts) as ground truth: this proves the QuickJS-bundled version
// computes byte-identical results to the real library for the same deterministic inputs, independent
// of memorized RFC 4122 vector strings.
const { v3: nodeV3, v5: nodeV5 } = await vi.importActual<typeof UuidModule>('uuid');
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

const runUuidTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var uuid = require('uuid');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'uuid']),
    bridge: noBridge,
    hostCrypto: nodeHostCrypto,
  });

const V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid regression suite (M3 vendored)', () => {
  it('v4() produces distinct, correctly-formatted UUIDs across repeated calls', async () => {
    const result = await runUuidTag(`
      var ids = [];
      for (var i = 0; i < 10; i++) { ids.push(uuid.v4()); }
      return ids.join(',');
    `);
    const ids = result.split(',');
    expect(ids).toHaveLength(10);
    ids.forEach(id => expect(id).toMatch(V4_RE));
    expect(new Set(ids).size).toBe(10);
  });

  it('validate()/version() round-trip for v1, v4, v5, and the nil UUID', async () => {
    const result = await runUuidTag(`
      return JSON.stringify({
        v1: uuid.validate(uuid.v1()) + ':' + uuid.version(uuid.v1()),
        v4: uuid.validate(uuid.v4()) + ':' + uuid.version(uuid.v4()),
        v5: uuid.validate(uuid.v5('example.com', uuid.v5.DNS)) + ':' + uuid.version(uuid.v5('example.com', uuid.v5.DNS)),
        nil: uuid.validate(uuid.NIL) + ':' + uuid.NIL,
      });
    `);
    expect(JSON.parse(result)).toEqual({
      v1: 'true:1',
      v4: 'true:4',
      v5: 'true:5',
      nil: 'true:00000000-0000-0000-0000-000000000000',
    });
  });

  it('v5(name, DNS namespace) matches the real npm package byte-for-byte', async () => {
    const expected = nodeV5('example.com', nodeV5.DNS);
    const result = await runUuidTag(`return uuid.v5('example.com', uuid.v5.DNS);`);
    expect(result).toBe(expected);
  });

  it('v5(name, URL namespace) matches the real npm package byte-for-byte', async () => {
    const expected = nodeV5('https://example.com/path', nodeV5.URL);
    const result = await runUuidTag(`return uuid.v5('https://example.com/path', uuid.v5.URL);`);
    expect(result).toBe(expected);
  });

  it('v3(name, DNS namespace) matches the real npm package byte-for-byte', async () => {
    const expected = nodeV3('example.com', nodeV3.DNS);
    const result = await runUuidTag(`return uuid.v3('example.com', uuid.v3.DNS);`);
    expect(result).toBe(expected);
  });

  it('v5 is deterministic across repeated calls with the same inputs', async () => {
    const result = await runUuidTag(`
      var a = uuid.v5('same-input', uuid.v5.DNS);
      var b = uuid.v5('same-input', uuid.v5.DNS);
      return (a === b) + ':' + a;
    `);
    const [equal, id] = result.split(':');
    expect(equal).toBe('true');
    expect(id).toBe(nodeV5('same-input', nodeV5.DNS));
  });
});
