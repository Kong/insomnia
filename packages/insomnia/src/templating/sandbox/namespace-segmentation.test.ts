import nodeCrypto from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createMapBridge, type HostBridge, scopePluginDataHandlers } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';

const nodeHostCrypto: HostCrypto = {
  hash: (algo, data, inputEncoding, outputEncoding) =>
    nodeCrypto.createHash(algo).update(data, inputEncoding as nodeCrypto.Encoding).digest(outputEncoding as nodeCrypto.BinaryToTextEncoding),
  hmac: (algo, key, data, outputEncoding) =>
    nodeCrypto.createHmac(algo, key).update(data, 'utf8').digest(outputEncoding as nodeCrypto.BinaryToTextEncoding),
  randomBytes: size => nodeCrypto.randomBytes(size).toString('base64'),
  randomUUID: () => nodeCrypto.randomUUID(),
};

const envelope = (args: unknown[], pluginName = 'attacker-plugin'): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux' },
  pluginName,
  renderDepth: 0,
});

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

describe('sandbox namespace segmentation', () => {
  // (A) Fix 1: the raw host bridge is no longer reachable from plugin code. __buildContext carries no
  // capability (it only reshapes the envelope) so it may remain; __hostBridge must be gone.
  it('(A) hides __hostBridge from plugin code', async () => {
    const source = `module.exports.templateTags = [{
      name: 'probe',
      run: function () {
        return 'hostBridge=' + (typeof globalThis.__hostBridge)
          + ' cryptoHash=' + (typeof globalThis.__cryptoHash);
      }
    }];`;
    const out = await runTagInSandbox({
      pluginSource: source, tagName: 'probe', envelope: envelope([]), bridge: noBridge,
    });
    expect(out).toBe('hostBridge=undefined cryptoHash=undefined');
  });

  // (A') Fix 1: the raw crypto host functions are deleted from the global even when crypto is enabled,
  // yet require('crypto') still works because the require shim closes over the captured references.
  it("(A') deletes raw crypto globals but keeps require('crypto') working", async () => {
    const source = `module.exports.templateTags = [{
      name: 'probe',
      run: function () {
        var leaked = typeof globalThis.__cryptoHash;
        var hash = require('crypto').createHash('sha256').update('hello world').digest('hex');
        return leaked + ':' + hash;
      }
    }];`;
    const out = await runTagInSandbox({
      pluginSource: source, tagName: 'probe', envelope: envelope([]), bridge: noBridge, hostCrypto: nodeHostCrypto,
    });
    const expected = nodeCrypto.createHash('sha256').update('hello world', 'utf8').digest('hex');
    expect(out).toBe(`undefined:${expected}`);
  });

  // (B) Fix 1: a tag trying to call the raw bridge directly fails — it's undefined, so the call throws.
  it('(B) a direct __hostBridge call throws inside the tag', async () => {
    const source = `module.exports.templateTags = [{
      name: 'steal',
      run: function () {
        return globalThis.__hostBridge('pluginData.getItem', JSON.stringify({ pluginName: 'victim-plugin', key: 'secret' }));
      }
    }];`;
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'steal', envelope: envelope([]), bridge: noBridge }),
    ).rejects.toThrow();
  });

  // (C) Fix 2: host-side scoping forces the trusted pluginName onto pluginData.* calls, end-to-end
  // through the legitimate context.store path.
  it('(C) forces the trusted pluginName on store calls', async () => {
    const handler = vi.fn(async (body: { pluginName: string; key: string }) => `value:${body.pluginName}`);
    const bridge = createMapBridge(
      scopePluginDataHandlers({ 'pluginData.getItem': handler }, 'attacker-plugin'),
    );
    const source = `module.exports.templateTags = [{
      name: 'read',
      run: function (context) { return context.store.getItem('secret'); }
    }];`;
    const out = await runTagInSandbox({
      pluginSource: source, tagName: 'read', envelope: envelope([], 'attacker-plugin'), bridge,
    });
    expect(handler).toHaveBeenCalledWith({ pluginName: 'attacker-plugin', key: 'secret' });
    expect(out).toBe('value:attacker-plugin');
  });

  // (C') Fix 2 unit: even a forged pluginName in the body is overridden with the trusted one.
  it("(C') scopePluginDataHandlers overrides a forged pluginName", async () => {
    const handler = vi.fn(async (body: { pluginName: string; key: string }) => body.pluginName);
    const scoped = scopePluginDataHandlers({ 'pluginData.getItem': handler }, 'attacker-plugin');
    await scoped['pluginData.getItem']({ pluginName: 'victim-plugin', key: 'secret' });
    expect(handler).toHaveBeenCalledWith({ pluginName: 'attacker-plugin', key: 'secret' });
  });

  // (D) Fix 3: a synchronous infinite loop is interrupted within the deadline instead of hanging.
  it('(D) interrupts a synchronous infinite loop', async () => {
    const source = 'module.exports.templateTags = [{ name: "spin", run: function () { while (true) {} } }];';
    await expect(
      runTagInSandbox({ pluginSource: source, tagName: 'spin', envelope: envelope([]), bridge: noBridge, timeoutMs: 200 }),
    ).rejects.toThrow();
  });
});
