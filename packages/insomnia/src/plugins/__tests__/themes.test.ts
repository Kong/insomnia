import { afterEach, describe, expect, it } from 'vitest';

import type { Plugin } from '../index';
// No mock of '../themes' here — this file tests the built-in theme baseline.
import { _testOnlySetPlugins, getThemes } from '../index';

const makePlugin = (overrides: Partial<Plugin> = {}): Plugin => ({
  name: 'test-plugin',
  description: 'A test plugin',
  version: '1.0.0',
  directory: '/plugins/test-plugin',
  config: { disabled: false },
  module: {},
  ...overrides,
});

afterEach(() => {
  _testOnlySetPlugins(null);
});

describe('getThemes — built-in themes', () => {
  it('returns all 18 built-in themes when no plugins are active', async () => {
    _testOnlySetPlugins([]);
    const themes = await getThemes();
    expect(themes).toHaveLength(18);
  });

  it('every built-in theme has a name and displayName', async () => {
    _testOnlySetPlugins([]);
    const themes = await getThemes();
    for (const { theme } of themes) {
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('displayName');
      expect(typeof theme.name).toBe('string');
      expect(theme.name.length).toBeGreaterThan(0);
    }
  });

  it('built-in theme entries carry the correct plugin metadata', async () => {
    _testOnlySetPlugins([]);
    const themes = await getThemes();
    for (const entry of themes) {
      expect(entry.plugin.description).toBe('Built-in themes');
      expect(entry.plugin.name).toBe(entry.theme.name);
    }
  });
});

describe('getThemes — merge with plugin themes', () => {
  it('plugin themes appear after built-in themes', async () => {
    const pluginTheme = { name: 'dracula', displayName: 'Dracula', theme: {} };
    _testOnlySetPlugins([makePlugin({ module: { themes: [pluginTheme] } })]);

    const themes = await getThemes();

    expect(themes).toHaveLength(19); // 18 built-in + 1 plugin
    expect(themes[18].theme).toBe(pluginTheme);
    expect(themes[18].plugin.name).toBe('test-plugin');
  });

  it('multiple plugins contribute themes independently', async () => {
    const themeA = { name: 'theme-a', displayName: 'Theme A', theme: {} };
    const themeB = { name: 'theme-b', displayName: 'Theme B', theme: {} };
    _testOnlySetPlugins([
      makePlugin({ name: 'plugin-a', module: { themes: [themeA] } }),
      makePlugin({ name: 'plugin-b', module: { themes: [themeB] } }),
    ]);

    const themes = await getThemes();

    expect(themes).toHaveLength(20);
    expect(themes.find(t => t.theme === themeA)?.plugin.name).toBe('plugin-a');
    expect(themes.find(t => t.theme === themeB)?.plugin.name).toBe('plugin-b');
  });

  it('disabled plugin themes do not appear in the list', async () => {
    _testOnlySetPlugins([
      makePlugin({
        config: { disabled: true },
        module: { themes: [{ name: 'hidden', displayName: 'Hidden', theme: {} }] },
      }),
    ]);
    const themes = await getThemes();
    expect(themes).toHaveLength(18); // only built-in
  });
});
