import type * as fsPromisesTypes from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data/path'),
    getAppPath: vi.fn(() => (globalThis as any).__yarnHome),
  },
}));

vi.mock('../main/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  AnalyticsEvent: {
    installPlugin: 'Plugin Installed',
  },
}));

vi.mock('insomnia-data', () => ({
  services: {
    settings: {
      get: vi.fn(() => Promise.resolve({})),
    },
  },
}));

const execFileMock = vi.fn();
vi.mock('node:child_process', async () => {
  // Mirror Node semantics: promisified execFile resolves { stdout, stderr }.
  const { promisify } = await import('node:util');
  const fn: any = (...args: any[]) => execFileMock(...args);
  fn[promisify.custom] = (cmd: any, args: any, opts: any) =>
    new Promise((resolve, reject) => {
      execFileMock(cmd, args, opts, (err: any, stdout: any, stderr: any) =>
        err ? reject(err) : resolve({ stdout, stderr }),
      );
    });
  return { execFile: fn };
});

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof fsPromisesTypes>('node:fs/promises');
  return {
    ...actual,
    writeFile: (async (file: any, data: any, ...rest: any[]) => {
      const store = ((globalThis as any).__writtenManifests ??= {}) as Record<string, string>;
      store[String(file)] = String(data);
      return actual.writeFile(file, data, ...rest);
    }) as any,
  };
});

import * as fsPromises from 'node:fs/promises';

import { getPluginInfo } from '../main/install-plugin';

const pluginPayload = {
  data: {
    name: 'insomnia-plugin-test',
    version: '1.0.0',
    insomnia: {
      name: 'Test Plugin',
      displayName: 'Test Plugin',
      description: 'A test plugin',
    },
    dist: {
      shasum: 'abc123',
      tarball: 'https://registry.npmjs.org/test-plugin/-/test-plugin-1.0.0.tgz',
    },
  },
};

describe('getPluginInfo working directory', () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  // getYarnPath only accepts app paths under the module base (src/), so
  // stage an empty standalone bundle inside the test dir for the lookup.
  const yarnHome = path.resolve(testDir, 'tmp-yarn-home');

  afterEach(async () => {
    await fsPromises.rm(yarnHome, { recursive: true, force: true });
  });

  it('runs yarn info in a controlled temp dir, not the process cwd', async () => {
    (globalThis as any).__writtenManifests = {};
    // Production layout resolves the bundle to ../bin relative to the app
    // path, so point the app one level below the staged bin directory.
    (globalThis as any).__yarnHome = path.resolve(yarnHome, 'app');
    await fsPromises.mkdir(path.resolve(yarnHome, 'bin'), { recursive: true });
    await fsPromises.writeFile(path.resolve(yarnHome, 'bin', 'yarn-standalone.js'), '', 'utf8');
    execFileMock.mockImplementation((_cmd: any, _args: any, _options: any, callback: any) => {
      callback?.(null, JSON.stringify(pluginPayload), '');
      return {} as any;
    });

    const result = await getPluginInfo('insomnia-plugin-test');
    expect(result.name).toBe('insomnia-plugin-test');

    expect(execFileMock).toHaveBeenCalledOnce();
    const options = execFileMock.mock.calls[0][2] as { cwd?: string };
    expect(options.cwd).toBeDefined();
    expect(options.cwd).not.toBe(process.cwd());
    expect(options.cwd?.startsWith(tmpdir())).toBe(true);

    const written = (globalThis as any).__writtenManifests as Record<string, string>;
    const manifestKey = Object.keys(written).find(key => key.endsWith('package.json'));
    expect(manifestKey).toBeDefined();
    expect(manifestKey?.startsWith(options.cwd as string)).toBe(true);
    expect(JSON.parse(written[manifestKey as string])).toMatchObject({ license: 'ISC' });
  });
});
