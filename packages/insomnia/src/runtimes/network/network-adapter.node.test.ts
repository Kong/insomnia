// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../plugins/context/app', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/data', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/network', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/request', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/response', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/store', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('insomnia-data', () => ({
  services: { settings: { get: vi.fn() } },
}));

import { services } from 'insomnia-data';

import { _testOnlySetPlugins, getPlugins } from '../../plugins/index';
import { applyRequestHooks, applyResponseHooks } from './network-adapter.node';

const makePlugin = (overrides: Record<string, any> = {}) => ({
  name: 'poc-plugin',
  description: '',
  version: '1.0.0',
  directory: '/plugins/poc-plugin',
  config: {},
  permissions: { modules: [], capabilities: [] },
  permissionWarnings: [],
  permissionsDeclared: false,
  module: {},
  ...overrides,
});

// Throws an Error whose own `plugin` property is a setter, so assigning to it (as the catch block does) runs `onSet` instead of just storing data.
const throwWithPoisonedPluginSetter = (onSet: (assignedPlugin: any) => void) => async () => {
  const err = new Error('hook failed');
  Object.defineProperty(err, 'plugin', {
    set: onSet,
    configurable: true,
  });
  throw err;
};

afterEach(() => {
  _testOnlySetPlugins(null);
  vi.clearAllMocks();
});

describe('applyRequestHooks / applyResponseHooks — plugin cache integrity on hook failure', () => {
  it('does not let a hook-thrown error mutate the cached Plugin object via a "plugin" setter trap', async () => {
    (services.settings.get as any).mockResolvedValue({ pluginSandboxEnabled: true });

    let setterInvoked = false;
    const hook = throwWithPoisonedPluginSetter(assigned => {
      setterInvoked = true;
      assigned.directory = '';
    });
    _testOnlySetPlugins([makePlugin({ module: { requestHooks: [hook] } })]);

    const renderedRequest = { headers: [] } as any;
    const renderedContext = { getProjectId: () => 'proj_x', DEFAULT_HEADERS: undefined };

    await expect(applyRequestHooks(renderedRequest, renderedContext)).rejects.toThrow('hook failed');

    // Attaching plugin info to the error must never go through an assignment the error can intercept.
    expect(setterInvoked).toBe(false);
    // The cached registry entry other code reads for trust decisions stays unaffected.
    const [cachedPlugin] = await getPlugins();
    expect(cachedPlugin.directory).toBe('/plugins/poc-plugin');
  });

  it('does not let a response-hook-thrown error mutate the cached Plugin object via a "plugin" setter trap', async () => {
    (services.settings.get as any).mockResolvedValue({ pluginSandboxEnabled: true });

    const hook = throwWithPoisonedPluginSetter(assigned => {
      assigned.config.elevated = true;
    });
    _testOnlySetPlugins([makePlugin({ config: { elevated: false }, module: { responseHooks: [hook] } })]);

    const response = {} as any;
    const renderedRequest = { headers: [] } as any;
    const renderedContext = { getProjectId: () => 'proj_x', DEFAULT_HEADERS: undefined };

    await expect(applyResponseHooks(response, renderedRequest, renderedContext)).rejects.toThrow('hook failed');

    const [cachedPlugin] = await getPlugins();
    expect(cachedPlugin.config.elevated).toBe(false);
  });
});
