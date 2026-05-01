import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../themes', () => ({ default: [] }));

import type { Plugin } from '../index';
import {
  _testOnlySetPlugins,
  getDocumentActions,
  getRequestActions,
  getRequestGroupActions,
  getRequestHooks,
  getResponseHooks,
  getTemplateTags,
  getThemes,
  getWorkspaceActions,
} from '../index';

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

describe('getRequestHooks', () => {
  it('always includes the built-in default-headers hook', async () => {
    _testOnlySetPlugins([]);
    const hooks = await getRequestHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].plugin.name).toBe('default-headers');
  });

  it('includes plugin hooks with plugin metadata', async () => {
    const hook = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { requestHooks: [hook] } })]);
    const hooks = await getRequestHooks();
    expect(hooks).toHaveLength(2);
    expect(hooks[1].hook).toBe(hook);
    expect(hooks[1].plugin.name).toBe('test-plugin');
  });

  it('excludes hooks from disabled plugins', async () => {
    _testOnlySetPlugins([makePlugin({ config: { disabled: true }, module: { requestHooks: [vi.fn()] } })]);
    const hooks = await getRequestHooks();
    expect(hooks).toHaveLength(1); // only built-in
  });
});

describe('getResponseHooks', () => {
  it('returns empty array when no plugins are active', async () => {
    _testOnlySetPlugins([]);
    expect(await getResponseHooks()).toHaveLength(0);
  });

  it('includes plugin hooks with plugin metadata', async () => {
    const hook = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { responseHooks: [hook] } })]);
    const hooks = await getResponseHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].hook).toBe(hook);
    expect(hooks[0].plugin.name).toBe('test-plugin');
  });

  it('excludes hooks from disabled plugins', async () => {
    _testOnlySetPlugins([makePlugin({ config: { disabled: true }, module: { responseHooks: [vi.fn()] } })]);
    expect(await getResponseHooks()).toHaveLength(0);
  });
});

describe('getRequestActions', () => {
  it('returns actions with plugin metadata', async () => {
    const action = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { requestActions: [{ label: 'Run', action }] } })]);
    const actions = await getRequestActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('Run');
    expect(actions[0].plugin.name).toBe('test-plugin');
  });

  it('excludes actions from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({ config: { disabled: true }, module: { requestActions: [{ label: 'Run', action: vi.fn() }] } }),
    ]);
    expect(await getRequestActions()).toHaveLength(0);
  });
});

describe('getWorkspaceActions', () => {
  it('returns actions with plugin metadata', async () => {
    const action = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { workspaceActions: [{ label: 'Export', action }] } })]);
    const actions = await getWorkspaceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('Export');
    expect(actions[0].plugin.name).toBe('test-plugin');
  });

  it('excludes actions from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({ config: { disabled: true }, module: { workspaceActions: [{ label: 'Export', action: vi.fn() }] } }),
    ]);
    expect(await getWorkspaceActions()).toHaveLength(0);
  });
});

describe('getRequestGroupActions', () => {
  it('returns actions with plugin metadata', async () => {
    const action = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { requestGroupActions: [{ label: 'Run All', action }] } })]);
    const actions = await getRequestGroupActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('Run All');
    expect(actions[0].plugin.name).toBe('test-plugin');
  });

  it('excludes actions from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({
        config: { disabled: true },
        module: { requestGroupActions: [{ label: 'Run All', action: vi.fn() }] },
      }),
    ]);
    expect(await getRequestGroupActions()).toHaveLength(0);
  });
});

describe('getDocumentActions', () => {
  it('returns actions with plugin metadata', async () => {
    const action = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { documentActions: [{ label: 'Lint', action }] } })]);
    const actions = await getDocumentActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('Lint');
    expect(actions[0].plugin.name).toBe('test-plugin');
  });

  it('excludes actions from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({ config: { disabled: true }, module: { documentActions: [{ label: 'Lint', action: vi.fn() }] } }),
    ]);
    expect(await getDocumentActions()).toHaveLength(0);
  });
});

describe('getTemplateTags', () => {
  it('returns template tags with plugin metadata', async () => {
    const tag = { name: 'env', displayName: 'Environment', run: vi.fn() };
    _testOnlySetPlugins([makePlugin({ module: { templateTags: [tag] } })]);
    const tags = await getTemplateTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].templateTag).toBe(tag);
    expect(tags[0].plugin.name).toBe('test-plugin');
  });

  it('excludes tags from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({ config: { disabled: true }, module: { templateTags: [{ name: 'env', run: vi.fn() }] } }),
    ]);
    expect(await getTemplateTags()).toHaveLength(0);
  });
});

describe('getThemes', () => {
  it('returns plugin themes with plugin metadata', async () => {
    const theme = { name: 'dracula', displayName: 'Dracula', theme: { background: { default: '#282a36' } } };
    _testOnlySetPlugins([makePlugin({ module: { themes: [theme] } })]);
    const themes = await getThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0].theme).toBe(theme);
    expect(themes[0].plugin.name).toBe('test-plugin');
  });

  it('excludes themes from disabled plugins', async () => {
    _testOnlySetPlugins([
      makePlugin({ config: { disabled: true }, module: { themes: [{ name: 'dracula', theme: {} }] } }),
    ]);
    expect(await getThemes()).toHaveLength(0);
  });
});
