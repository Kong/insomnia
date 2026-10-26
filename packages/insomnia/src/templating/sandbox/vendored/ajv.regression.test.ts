import nodeCrypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from '../host-bridge';
import { type ContextEnvelope } from '../marshal';
import { type HostCrypto, runTagInSandbox } from '../plugin-tag-sandbox';

// Per-lib regression suite (M3) for the sandbox-vendored "ajv" bundle. Exercises the exact API
// surface the sandbox factory exposes, run through the real QuickJS harness (not the bare npm
// package) — the point is to catch bundling regressions on upgrade, not just upstream ajv bugs.
// Kept separate from vendored-libs.test.ts (registry-wiring tests) since this is intentionally
// larger and scoped to one library.
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

const runAjvTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var Ajv = require('ajv');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'ajv']),
    bridge: noBridge,
    hostCrypto: nodeHostCrypto,
  });

describe('ajv regression suite (M3 vendored)', () => {
  it('validates required fields', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
      return (validate({ n: 1 }) ? 'valid' : 'invalid') + ',' + (validate({}) ? 'valid' : 'invalid');
    `);
    expect(result).toBe('valid,invalid');
  });

  it('validates nested objects', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({
        type: 'object',
        properties: { user: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
        required: ['user'],
      });
      return (validate({ user: { name: 'a' } }) ? 'valid' : 'invalid') + ',' + (validate({ user: {} }) ? 'valid' : 'invalid');
    `);
    expect(result).toBe('valid,invalid');
  });

  it('validates arrays', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'array', items: { type: 'number' }, minItems: 1 });
      return (validate([1, 2, 3]) ? 'valid' : 'invalid') + ',' + (validate([]) ? 'valid' : 'invalid') + ',' + (validate(['x']) ? 'valid' : 'invalid');
    `);
    expect(result).toBe('valid,invalid,invalid');
  });

  it('validates enums', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'string', enum: ['a', 'b', 'c'] });
      return (validate('b') ? 'valid' : 'invalid') + ',' + (validate('z') ? 'valid' : 'invalid');
    `);
    expect(result).toBe('valid,invalid');
  });

  it('rejects additional properties when additionalProperties is false', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false });
      return (validate({ a: 'x' }) ? 'valid' : 'invalid') + ',' + (validate({ a: 'x', b: 'y' }) ? 'valid' : 'invalid');
    `);
    expect(result).toBe('valid,invalid');
  });

  it('exposes a stable validate.errors shape on failure', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
      validate({});
      var err = validate.errors[0];
      return JSON.stringify({ keyword: err.keyword, params: err.params, instancePath: err.instancePath });
    `);
    expect(JSON.parse(result)).toEqual({ keyword: 'required', params: { missingProperty: 'n' }, instancePath: '' });
  });

  it('reuses a compiled validator across repeated calls (compiled-validator state)', async () => {
    const result = await runAjvTag(`
      var validate = new Ajv().compile({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
      var results = [];
      for (var i = 0; i < 5; i++) { results.push(validate({ n: i }) ? '1' : '0'); }
      results.push(validate({ n: 'x' }) ? '1' : '0');
      return results.join('');
    `);
    expect(result).toBe('111110');
  });
});
