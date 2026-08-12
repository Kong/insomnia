import { describe, expect, it } from 'vitest';

import { isSandboxEnabled, resolvePluginExecutionMode, shouldSandboxPlugin } from './sandbox-mode';

const userPlugin = (elevated?: boolean) => ({ directory: '/plugins/insomnia-plugin-x', config: { elevated } });
const bundlePlugin = { directory: '', config: {} };

describe('isSandboxEnabled', () => {
  it('is off when the flag is unset', () => {
    expect(isSandboxEnabled({})).toBe(false);
    expect(isSandboxEnabled()).toBe(false);
    expect(isSandboxEnabled({ pluginSandboxEnabled: false })).toBe(false);
  });
  it('pluginSandboxEnabled activates the sandbox', () => {
    expect(isSandboxEnabled({ pluginSandboxEnabled: true })).toBe(true);
  });
});

describe('resolvePluginExecutionMode', () => {
  it('bundle plugins are always internal, regardless of flags/elevated', () => {
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, bundlePlugin)).toBe('internal');
    expect(resolvePluginExecutionMode({}, bundlePlugin)).toBe('internal');
  });
  it('user plugin with sandbox off is unsandboxed (legacy in-process), not internal', () => {
    expect(resolvePluginExecutionMode({}, userPlugin())).toBe('unsandboxed');
  });
  it('user plugin with sandbox on and not elevated is sandboxed (default-deny)', () => {
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, userPlugin(false))).toBe('sandboxed');
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, userPlugin())).toBe('sandboxed');
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
