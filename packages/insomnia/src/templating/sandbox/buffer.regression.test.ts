import nodeBufferModule from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// require('buffer') is a thin re-export of the ambient `Buffer` global (sandbox-globals.ts) — its
// own regression coverage is about the module shape/identity, not Buffer's instance-method behavior,
// which is already covered (as an ambient global, not a require()-gated one) in the "Buffer parity
// vs node:Buffer" block in plugin-tag-sandbox.test.ts.
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

const runBufferTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var buf = require('buffer');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'buffer']),
    bridge: noBridge,
  });

describe('buffer regression suite', () => {
  it('require("buffer").Buffer is the exact same object as the ambient global Buffer, matching real Node', async () => {
    const result = await runBufferTag('return String(buf.Buffer === Buffer);');
    expect(result).toBe(String(nodeBufferModule.Buffer === Buffer));
  });

  it('require("buffer").Buffer is fully usable (not a stub) — from/alloc/toString round-trip', async () => {
    const result = await runBufferTag("return buf.Buffer.from('hello', 'utf8').toString('utf8');");
    expect(result).toBe('hello');
  });

  it('exposes INSPECT_MAX_BYTES and kMaxLength as numbers', async () => {
    const result = await runBufferTag('return JSON.stringify({ i: typeof buf.INSPECT_MAX_BYTES, k: typeof buf.kMaxLength });');
    expect(JSON.parse(result)).toEqual({ i: 'number', k: 'number' });
  });

  it('declaring "buffer" does not restrict anything beyond the already-ambient global (documented, not a security boundary)', async () => {
    // Buffer is reachable with zero grant at all — confirms the module gate is purely a convenience
    // re-export, not an actual capability restriction, so this isn't a false sense of security.
    const withoutGrant = await runTagInSandbox({
      pluginSource: "module.exports.templateTags = [{ name: 't', run: function () { return Buffer.from('ok').toString('utf8'); } }];",
      tagName: 't',
      envelope: envelope([]),
      bridge: noBridge,
    });
    expect(withoutGrant).toBe('ok');
  });
});
