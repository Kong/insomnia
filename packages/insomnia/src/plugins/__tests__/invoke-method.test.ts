import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../themes', () => ({ default: [] }));
vi.mock('../context/app', () => ({ init: vi.fn().mockReturnValue({ app: {} }) }));
vi.mock('../context/data', () => ({ init: vi.fn().mockReturnValue({ data: {} }) }));
vi.mock('../context/store', () => ({ init: vi.fn().mockReturnValue({ store: {} }) }));
vi.mock('../context/network', () => ({ init: vi.fn().mockReturnValue({ network: {} }) }));
vi.mock('../context/request', () => ({ init: vi.fn().mockReturnValue({ request: {} }) }));
vi.mock('../context/response', () => ({ init: vi.fn().mockReturnValue({ response: {} }) }));
vi.mock('../../templating', () => ({ render: vi.fn(), reload: vi.fn() }));
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

import { render as renderTemplate } from '../../templating';
import type { Plugin } from '../index';
import { _testOnlySetPlugins } from '../index';
import { invokePluginMethod } from '../invoke-method';

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
  vi.clearAllMocks();
});

describe('invokePluginMethod', () => {
  it('serializes request action metadata', async () => {
    _testOnlySetPlugins([
      makePlugin({ module: { requestActions: [{ label: 'Run', icon: 'bolt', action: vi.fn() }] } }),
    ]);

    await expect(invokePluginMethod('getRequestActions')).resolves.toEqual([
      { label: 'Run', icon: 'bolt', pluginName: 'test-plugin' },
    ]);
  });

  it('executes the matching action locally', async () => {
    const action = vi.fn().mockResolvedValue(null);
    _testOnlySetPlugins([makePlugin({ module: { requestActions: [{ label: 'Run', action }] } })]);

    await expect(
      invokePluginMethod('executeAction', {
        type: 'request',
        pluginName: 'test-plugin',
        label: 'Run',
        projectId: 'proj_1',
        domainData: { request: { _id: 'req_1' } },
      }),
    ).resolves.toBeNull();

    expect(action).toHaveBeenCalledWith(expect.objectContaining({ app: {}, data: {}, store: {}, network: {} }), {
      request: { _id: 'req_1' },
    });
  });

  it('preserves plugin-prefixed request hook errors', async () => {
    const hook = vi.fn().mockRejectedValue(new Error('boom'));
    _testOnlySetPlugins([makePlugin({ module: { requestHooks: [hook] } })]);

    await expect(
      invokePluginMethod('applyRequestHooks', {
        renderedRequest: { url: 'https://example.com' } as any,
        projectId: 'proj_1',
        environment: {},
      }),
    ).rejects.toThrow('[plugin=test-plugin] boom');
  });

  it('rehydrates serialized render context before rendering templates', async () => {
    vi.mocked(renderTemplate).mockResolvedValue('rendered');

    await expect(
      invokePluginMethod('renderTemplate', {
        input: '{{ foo }}',
        path: 'body.text',
        ignoreUndefinedEnvVariable: false,
        context: {
          foo: 'bar',
          serializedFunctions: {
            requestId: 'req_1',
            workspaceId: 'wrk_1',
            environmentId: 'env_1',
            extraInfo: { requestChain: ['req_1'] },
            globalEnvironmentId: 'genv_1',
            keysContext: { keyContext: { foo: 'Base Env' } },
            projectId: 'proj_1',
            purpose: 'send',
            settings: { dataFolders: [] },
          },
        },
      }),
    ).resolves.toBe('rendered');

    expect(renderTemplate).toHaveBeenCalledWith(
      '{{ foo }}',
      expect.objectContaining({
        path: 'body.text',
        ignoreUndefinedEnvVariable: false,
        context: expect.objectContaining({
          foo: 'bar',
          getMeta: expect.any(Function),
          getEnvironmentId: expect.any(Function),
          getExtraInfo: expect.any(Function),
          getGlobalEnvironmentId: expect.any(Function),
          getKeysContext: expect.any(Function),
          getProjectId: expect.any(Function),
          getPurpose: expect.any(Function),
          getSettings: expect.any(Function),
        }),
      }),
    );

    const renderContext = vi.mocked(renderTemplate).mock.calls[0]?.[1]?.context as Record<string, any>;
    expect(renderContext.getMeta()).toEqual({ requestId: 'req_1', workspaceId: 'wrk_1' });
    expect(renderContext.getEnvironmentId()).toBe('env_1');
    expect(renderContext.getExtraInfo()).toEqual({ requestChain: ['req_1'] });
    expect(renderContext.getGlobalEnvironmentId()).toBe('genv_1');
    expect(renderContext.getKeysContext()).toEqual({ keyContext: { foo: 'Base Env' } });
    expect(renderContext.getProjectId()).toBe('proj_1');
    expect(renderContext.getPurpose()).toBe('send');
    expect(renderContext.getSettings()).toEqual({ dataFolders: [] });
  });
});
