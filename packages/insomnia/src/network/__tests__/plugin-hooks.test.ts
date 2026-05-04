import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../plugins/index', () => ({
  getRequestHooks: vi.fn(),
  getResponseHooks: vi.fn(),
}));
vi.mock('../../plugins/context/app', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/data', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/store', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/request', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/response', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/network', () => ({ init: vi.fn().mockReturnValue({}) }));

import * as pluginsIndex from '../../plugins/index';
import { _applyRequestPluginHooks, _applyResponsePluginHooks } from '../network';

const mockPlugin = {
  name: 'test-plugin',
  description: '',
  version: '1.0.0',
  directory: '',
  config: { disabled: false },
  module: {},
};

const mockRenderedRequest = {
  url: 'http://example.com',
  settingSendCookies: true,
  settingStoreCookies: true,
} as any;

const mockRenderedContext = {
  getProjectId: () => '',
} as any;

const mockResponse = {
  url: 'http://example.com',
  status: 200,
} as any;

beforeEach(() => {
  vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([]);
  vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([]);
});

describe('_applyRequestPluginHooks', () => {
  it('calls each hook with a context object', async () => {
    const hook = vi.fn();
    vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([{ plugin: mockPlugin, hook }]);

    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);

    expect(hook).toHaveBeenCalledOnce();
    expect(hook).toHaveBeenCalledWith(expect.any(Object));
  });

  it('re-throws a synchronous hook error with err.plugin attached', async () => {
    const error = new Error('sync failure');
    vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw error;
        },
      },
    ]);

    await expect(_applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext)).rejects.toThrow('sync failure');
    expect(error).toHaveProperty('plugin', mockPlugin);
  });

  it('re-throws an async hook rejection with err.plugin attached', async () => {
    const error = new Error('async failure');
    vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: async () => {
          throw error;
        },
      },
    ]);

    await expect(_applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext)).rejects.toThrow('async failure');
    expect(error).toHaveProperty('plugin', mockPlugin);
  });

  it('wraps non-Error throws into an Error with plugin metadata attached', async () => {
    vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw 'string error';
        },
      },
    ]);

    const error = await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext).catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('string error');
    expect(error).toHaveProperty('plugin', mockPlugin);
  });

  it('stops processing further hooks after the first failure', async () => {
    const secondHook = vi.fn();
    vi.mocked(pluginsIndex.getRequestHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw new Error('first hook fails');
        },
      },
      { plugin: mockPlugin, hook: secondHook },
    ]);

    await expect(_applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext)).rejects.toThrow();
    expect(secondHook).not.toHaveBeenCalled();
  });
});

describe('_applyResponsePluginHooks', () => {
  it('calls each hook with a context object', async () => {
    const hook = vi.fn();
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([{ plugin: mockPlugin, hook }]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(hook).toHaveBeenCalledOnce();
    expect(result).not.toHaveProperty('error');
  });

  it('returns an error ResponsePatch instead of throwing on hook failure', async () => {
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw new Error('hook exploded');
        },
      },
    ]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result).toHaveProperty('error');
    expect(result.statusMessage).toBe('Error');
  });

  it('includes the plugin name in the error message', async () => {
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw new Error('boom');
        },
      },
    ]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result.error).toContain('test-plugin');
  });

  it('includes the original error message in the error response', async () => {
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw new Error('detailed failure reason');
        },
      },
    ]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result.error).toContain('detailed failure reason');
  });

  it('returns an error ResponsePatch for async hook rejections', async () => {
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: async () => {
          throw new Error('async boom');
        },
      },
    ]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('async boom');
  });

  it('preserves the request URL in the error response', async () => {
    vi.mocked(pluginsIndex.getResponseHooks).mockResolvedValue([
      {
        plugin: mockPlugin,
        hook: () => {
          throw new Error('fail');
        },
      },
    ]);

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result.url).toBe('http://example.com');
  });
});
