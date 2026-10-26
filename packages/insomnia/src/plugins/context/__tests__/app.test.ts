import { afterEach, describe, expect, it, vi } from 'vitest';

import appPackageJson from '../../../../package.json';
import * as runtimes from '../../../runtimes';
import * as plugin from '../app';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('init()', () => {
  it('initializes correctly', async () => {
    const result = plugin.init();
    expect(Object.keys(result)).toEqual(['app']);
    expect(Object.keys(result.app).sort()).toEqual(
      ['alert', 'clipboard', 'dialog', 'getPath', 'getInfo', 'prompt', 'showSaveDialog'].sort(),
    );
    expect(Object.keys(result.app.clipboard).sort()).toEqual(['clear', 'readText', 'writeText'].sort());
  });
});

describe('app.getInfo()', () => {
  it('provides app info', async () => {
    const result = plugin.init();
    expect(result.app.getInfo()).toEqual({
      version: appPackageJson.version,
      platform: process.platform,
    });
  });
});

describe('app.prompt()', () => {
  it('uses the registered non-renderer prompt handler', async () => {
    const handler = vi.fn(async () => 'typed value');
    const options = { label: 'Label', defaultValue: 'cached value', inputType: 'password' };

    vi.spyOn(runtimes, 'getRuntime').mockReturnValue({ app: { prompt: handler } } as any);

    await expect(plugin.init('send').app.prompt('Title', options)).resolves.toBe('typed value');
    expect(handler).toHaveBeenCalledWith('Title', options);
  });

  it('rejects when the registered non-renderer prompt handler rejects', async () => {
    vi.spyOn(runtimes, 'getRuntime').mockReturnValue({
      app: {
        prompt: vi.fn(async () => {
          throw new Error('Prompt Title cancelled');
        }),
      },
    } as any);

    await expect(plugin.init('send').app.prompt('Title')).rejects.toThrow('Prompt Title cancelled');
  });

  it('falls back to the default value without a non-renderer app runtime', async () => {
    vi.spyOn(runtimes, 'getRuntime').mockReturnValue({} as any);

    await expect(plugin.init('send').app.prompt('Title', { defaultValue: 'cached value' })).resolves.toBe(
      'cached value',
    );
  });
});
