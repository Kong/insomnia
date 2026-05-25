import { describe, expect, it, vi } from 'vitest';

import type { Services } from '../../';

const loadServicesModule = async () => {
  vi.resetModules();
  return import('./index');
};

const createServicesImpl = () => {
  const get = vi.fn().mockResolvedValue('settings');

  return {
    impl: {
      settings: {
        get,
      },
    } as unknown as Services,
    get,
  };
};

describe('services', () => {
  it('calls a service method after initialization', async () => {
    const { initServices, services } = await loadServicesModule();
    const { impl, get } = createServicesImpl();

    initServices(impl);

    await expect(services.settings.get()).resolves.toBe('settings');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('allows destructuring a service before initialization', async () => {
    const { initServices, services } = await loadServicesModule();
    const { settings } = services;
    const { impl, get } = createServicesImpl();

    initServices(impl);

    await expect(settings.get()).resolves.toBe('settings');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('allows destructuring a service method before initialization', async () => {
    const { initServices, services } = await loadServicesModule();
    const { get: getSettings } = services.settings;
    const { impl, get } = createServicesImpl();

    initServices(impl);

    await expect(getSettings()).resolves.toBe('settings');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('still throws when a deferred service method is called before initialization', async () => {
    const { services } = await loadServicesModule();

    await expect(async () => services.settings.get()).rejects.toThrow(
      'Service not initialized. Call initServices() first.',
    );
  });
});
