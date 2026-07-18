import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope, type PluginExportManifest } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// L1 load-time discovery: evaluate a plugin's entry inside the sandbox and return a manifest of its
// exports, instead of nodeRequire-ing it on the host. The plugin's top-level code runs — but in the
// sandbox, so it can't touch the host. These tests drive the discovery path directly.

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const envelope = (
  moduleFiles: Record<string, string>,
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
  entryModuleKey: 'index.js',
});

const discover = async (
  moduleFiles: Record<string, string>,
  grantedModules?: string[],
): Promise<PluginExportManifest> => {
  const json = await runTagInSandbox({
    tagName: '',
    discover: true,
    envelope: envelope(moduleFiles, grantedModules),
    bridge: noBridge,
  });
  return JSON.parse(json) as PluginExportManifest;
};

describe('sandbox export discovery (L1)', () => {
  it('returns a manifest of a multi-export plugin without running any export', async () => {
    const manifest = await discover({
      'index.js': `
        module.exports.templateTags = [
          { name: 'a', displayName: 'Tag A', description: 'first', args: [{ type: 'string' }], run: function () { return 'ran-a'; } },
          { name: 'b', run: function () { return 'ran-b'; } },
        ];
        module.exports.requestHooks = [function () {}, function () {}];
        module.exports.responseHooks = [function () {}];
        module.exports.requestActions = [{ label: 'Do It', icon: 'fa-bolt', action: function () {} }];
        module.exports.workspaceActions = [{ label: 'WS', action: function () {} }];
        module.exports.themes = [{ name: 't', displayName: 'Theme', theme: { background: { default: '#000' } } }];`,
    });

    expect(manifest.templateTags).toEqual([
      { name: 'a', displayName: 'Tag A', description: 'first', args: [{ type: 'string' }] },
      { name: 'b', displayName: undefined, description: undefined, args: [] },
    ]);
    expect(manifest.requestHooks).toBe(2);
    expect(manifest.responseHooks).toBe(1);
    expect(manifest.requestActions).toEqual([{ label: 'Do It', icon: 'fa-bolt' }]);
    expect(manifest.workspaceActions).toEqual([{ label: 'WS', icon: undefined }]);
    expect(manifest.documentActions).toEqual([]);
    expect(manifest.themes).toEqual([{ name: 't', displayName: 'Theme', theme: { background: { default: '#000' } } }]);
  });

  it('resolves relative requires while discovering (multi-file plugin)', async () => {
    const manifest = await discover({
      'index.js': "module.exports.templateTags = require('./tags');",
      'tags.js': "module.exports = [{ name: 'fromlib', run: function () { return 'x'; } }];",
    });
    expect(manifest.templateTags).toEqual([
      { name: 'fromlib', displayName: undefined, description: undefined, args: [] },
    ]);
  });

  it('clamps a hostile hook count so the host cannot be driven into a huge allocation', async () => {
    // A plugin exports a non-array with a giant `.length`; the manifest count must be clamped, not
    // passed through, so the host's Array.from({ length }) can't be weaponized into an OOM.
    const manifest = await discover({
      'index.js': `
        module.exports.requestHooks = { length: 1e12 };
        module.exports.responseHooks = [function () {}, function () {}, function () {}];
        module.exports.templateTags = [];`,
    });
    expect(manifest.requestHooks).toBe(1000);
    expect(manifest.responseHooks).toBe(3);
  });

  it('contains a throwing top-level (surfaced as a rejection, not a host crash)', async () => {
    await expect(discover({ 'index.js': "throw new Error('boom at load');" })).rejects.toThrow(/boom at load/);
  });

  it('denies a top-level require of an ungranted module (proves discovery runs in the sandbox)', async () => {
    // A plugin whose top-level does require('child_process') to spawn a process gets nothing: the
    // sandbox require is default-deny, so discovery fails the same way tag execution would — the
    // host is never reached.
    await expect(
      discover({ 'index.js': "require('child_process'); module.exports.templateTags = [];" }),
    ).rejects.toThrow(/not permitted by manifest/);
  });
});
