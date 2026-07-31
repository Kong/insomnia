import { describe, expect, it } from 'vitest';

import { isSandboxEnabled, resolvePluginExecutionMode, shouldSandboxPlugin } from './sandbox-mode';

const userPlugin = (elevated?: boolean) => ({ directory: '/plugins/insomnia-plugin-x', config: { elevated } });
const bundlePlugin = { directory: '', config: {} };

describe('isSandboxEnabled (flag supersession)', () => {
  it('is off when neither flag is set', () => {
    expect(isSandboxEnabled({})).toBe(false);
    expect(isSandboxEnabled()).toBe(false);
  });
  it('the legacy templateTagSandboxEnabled still activates the sandbox (migration bridge)', () => {
    expect(isSandboxEnabled({ templateTagSandboxEnabled: true })).toBe(true);
  });
  it('the new pluginSandboxEnabled activates the sandbox', () => {
    expect(isSandboxEnabled({ pluginSandboxEnabled: true })).toBe(true);
  });
  it('either flag on is enough', () => {
    expect(isSandboxEnabled({ templateTagSandboxEnabled: true, pluginSandboxEnabled: false })).toBe(true);
    expect(isSandboxEnabled({ templateTagSandboxEnabled: false, pluginSandboxEnabled: true })).toBe(true);
  });
});

describe('resolvePluginExecutionMode', () => {
  it('bundle plugins are always trusted, regardless of flags/elevated', () => {
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, bundlePlugin)).toBe('trusted');
    expect(resolvePluginExecutionMode({}, bundlePlugin)).toBe('trusted');
  });
  it('user plugin with sandbox off is unsandboxed (legacy in-process), not trusted', () => {
    expect(resolvePluginExecutionMode({}, userPlugin())).toBe('unsandboxed');
  });
  it('user plugin with sandbox on and not elevated is sandboxed (default-deny)', () => {
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, userPlugin(false))).toBe('sandboxed');
    expect(resolvePluginExecutionMode({ templateTagSandboxEnabled: true }, userPlugin())).toBe('sandboxed');
  });
  it('user plugin explicitly elevated runs in-process even with sandbox on', () => {
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, userPlugin(true))).toBe('elevated');
  });
});

describe('shouldSandboxPlugin (the gate every surface reads)', () => {
  it('true only for a user plugin, sandbox on, not elevated', () => {
    expect(shouldSandboxPlugin({ pluginSandboxEnabled: true }, userPlugin(false))).toBe(true);
  });
  it('false for bundle plugins', () => {
    expect(shouldSandboxPlugin({ pluginSandboxEnabled: true }, bundlePlugin)).toBe(false);
  });
  it('false when sandbox is off', () => {
    expect(shouldSandboxPlugin({}, userPlugin(false))).toBe(false);
  });
  it('false for an elevated user plugin (the escape hatch)', () => {
    expect(shouldSandboxPlugin({ pluginSandboxEnabled: true }, userPlugin(true))).toBe(false);
  });
});
