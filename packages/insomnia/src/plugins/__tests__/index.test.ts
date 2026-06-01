// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../themes', () => ({ default: [] }));
vi.mock('~/templating/liquid-extension-worker', () => ({
  fetchFromTemplateWorkerDatabase: vi.fn(),
}));
vi.mock('../context/app', () => ({ init: vi.fn().mockReturnValue({ app: {} }) }));
vi.mock('../context/store', () => ({ init: vi.fn().mockReturnValue({ store: {} }) }));
vi.mock('../context/network', () => ({ init: vi.fn().mockReturnValue({ network: {} }) }));
vi.mock('~/insomnia-data', () => ({
  services: {
    settings: { get: vi.fn() },
    request: { getById: vi.fn() },
    cloudCredential: { getById: vi.fn(), update: vi.fn() },
    workspace: { getById: vi.fn() },
    oAuth2Token: { getByParentId: vi.fn() },
    cookieJar: { getOrCreateForParentId: vi.fn() },
    response: { getLatestForRequestId: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
  },
}));

import { fetchFromTemplateWorkerDatabase } from '~/templating/liquid-extension-worker';

import type { Plugin } from '../index';
import {
  _testOnlySetPlugins,
  executePluginMainAction,
  getDocumentActions,
  getPluginCommonContext,
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
  it('returns empty array when no plugins are active', async () => {
    _testOnlySetPlugins([]);
    expect(await getRequestHooks()).toHaveLength(0);
  });

  it('includes plugin hooks with plugin metadata', async () => {
    const hook = vi.fn();
    _testOnlySetPlugins([makePlugin({ module: { requestHooks: [hook] } })]);
    const hooks = await getRequestHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].hook).toBe(hook);
    expect(hooks[0].plugin.name).toBe('test-plugin');
  });

  it('excludes hooks from disabled plugins', async () => {
    _testOnlySetPlugins([makePlugin({ config: { disabled: true }, module: { requestHooks: [vi.fn()] } })]);
    const hooks = await getRequestHooks();
    expect(hooks).toHaveLength(0);
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

  it('action is callable and receives the args passed by the caller', async () => {
    const action = vi.fn().mockResolvedValue();
    _testOnlySetPlugins([makePlugin({ module: { requestActions: [{ label: 'Run', action }] } })]);
    const [{ action: retrieved }] = await getRequestActions();

    const context = { app: {} };
    const models = { request: { _id: 'req_1' } };
    await retrieved(context as any, models as any);

    expect(action).toHaveBeenCalledWith(context, models);
  });

  it('action errors propagate to the caller', async () => {
    const action = vi.fn().mockRejectedValue(new Error('request action failed'));
    _testOnlySetPlugins([makePlugin({ module: { requestActions: [{ label: 'Run', action }] } })]);
    const [{ action: retrieved }] = await getRequestActions();

    await expect(retrieved({} as any, {} as any)).rejects.toThrow('request action failed');
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

  it('action is callable and receives the args passed by the caller', async () => {
    const action = vi.fn().mockResolvedValue();
    _testOnlySetPlugins([makePlugin({ module: { workspaceActions: [{ label: 'Export', action }] } })]);
    const [{ action: retrieved }] = await getWorkspaceActions();

    const context = { app: {} };
    const models = { workspace: { _id: 'wrk_1' }, requestGroups: [], requests: [] };
    await retrieved(context as any, models as any);

    expect(action).toHaveBeenCalledWith(context, models);
  });

  it('action errors propagate to the caller', async () => {
    const action = vi.fn().mockRejectedValue(new Error('workspace action failed'));
    _testOnlySetPlugins([makePlugin({ module: { workspaceActions: [{ label: 'Export', action }] } })]);
    const [{ action: retrieved }] = await getWorkspaceActions();

    await expect(retrieved({} as any, {} as any)).rejects.toThrow('workspace action failed');
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

  it('action is callable and receives the args passed by the caller', async () => {
    const action = vi.fn().mockResolvedValue();
    _testOnlySetPlugins([makePlugin({ module: { requestGroupActions: [{ label: 'Run All', action }] } })]);
    const [{ action: retrieved }] = await getRequestGroupActions();

    const context = { app: {} };
    const models = { requestGroup: { _id: 'grp_1' }, requests: [] };
    await retrieved(context as any, models as any);

    expect(action).toHaveBeenCalledWith(context, models);
  });

  it('action errors propagate to the caller', async () => {
    const action = vi.fn().mockRejectedValue(new Error('group action failed'));
    _testOnlySetPlugins([makePlugin({ module: { requestGroupActions: [{ label: 'Run All', action }] } })]);
    const [{ action: retrieved }] = await getRequestGroupActions();

    await expect(retrieved({} as any, {} as any)).rejects.toThrow('group action failed');
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

  it('action is callable and receives the args passed by the caller', async () => {
    const action = vi.fn().mockResolvedValue();
    _testOnlySetPlugins([makePlugin({ module: { documentActions: [{ label: 'Lint', action }] } })]);
    const [{ action: retrieved }] = await getDocumentActions();

    const context = { app: {} };
    const spec = { contents: 'openapi: 3.0.0' };
    await retrieved(context as any, spec as any);

    expect(action).toHaveBeenCalledWith(context, spec);
  });

  it('action errors propagate to the caller — the plugin layer does not swallow them', async () => {
    const action = vi.fn().mockRejectedValue(new Error('lint failed'));
    _testOnlySetPlugins([makePlugin({ module: { documentActions: [{ label: 'Lint', action }] } })]);
    const [{ action: retrieved }] = await getDocumentActions();

    await expect(retrieved({} as any, {} as any)).rejects.toThrow('lint failed');
  });

  it('supports hideAfterClick flag', async () => {
    _testOnlySetPlugins([
      makePlugin({ module: { documentActions: [{ label: 'Lint', action: vi.fn(), hideAfterClick: true }] } }),
    ]);
    const [item] = await getDocumentActions();
    expect(item.hideAfterClick).toBe(true);
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

  it('run() is callable and errors propagate — the plugin layer does not catch them', async () => {
    const run = vi.fn().mockRejectedValue(new Error('tag run failed'));
    _testOnlySetPlugins([makePlugin({ module: { templateTags: [{ name: 'env', run }] } })]);
    const [{ templateTag }] = await getTemplateTags();
    await expect(templateTag.run({} as any, [])).rejects.toThrow('tag run failed');
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

describe('getPluginCommonContext', () => {
  it('returns an object with the expected top-level keys', () => {
    const ctx = getPluginCommonContext({ plugin: { name: 'test-plugin' } });
    expect(ctx).toHaveProperty('app');
    expect(ctx).toHaveProperty('store');
    expect(ctx).toHaveProperty('network');
    expect(ctx).toHaveProperty('util');
  });
});

describe('executePluginMainAction', () => {
  const bundlePluginName = '@kong/insomnia-plugin-external-vault';

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to main process via IPC and returns the result', async () => {
    vi.mocked(fetchFromTemplateWorkerDatabase).mockResolvedValue('action-result');

    const result = await executePluginMainAction({
      pluginName: bundlePluginName,
      actionName: 'doThing',
      context: { foo: 'bar' },
      params: { x: 1 },
    });

    expect(fetchFromTemplateWorkerDatabase).toHaveBeenCalledWith('plugin.executeBundlePluginMainAction', {
      pluginName: bundlePluginName,
      actionName: 'doThing',
      context: { foo: 'bar' },
      params: { x: 1 },
    });
    expect(result).toBe('action-result');
  });

  it('propagates rejections from the IPC call', async () => {
    vi.mocked(fetchFromTemplateWorkerDatabase).mockRejectedValue(new Error('IPC failure'));

    await expect(
      executePluginMainAction({ pluginName: bundlePluginName, actionName: 'doThing' }),
    ).rejects.toThrow('IPC failure');
  });
});
