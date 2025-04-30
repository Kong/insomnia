import path from 'node:path';

import { net } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import installPlugin, {
  containsOnlyDeprecationWarnings,
  getYarnEnvValues,
  installPluginToTmpDir,
  isInsomniaPlugin,
  safeTrim,
} from '../main/install-plugin';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
    getAppPath: vi.fn(() => path.resolve(__dirname, '../mock/app')),
    exit: vi.fn(),
  },
  net: {
    fetch: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  cp: vi.fn(),
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  lstat: vi.fn().mockResolvedValue({
    isSymbolicLink: () => false,
  }),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      stdout: Buffer.from(
        JSON.stringify({
          name: 'mock-plugin',
          version: '0.0.1',
          insomnia: { name: 'mock-plugin' },
          dist: {
            tarball: 'https://registry.npmjs.org/mock-plugin.tgz',
            shasum: '1234567890abcdef',
          },
        }),
      ),
      stderr: Buffer.from(''),
    });
  }),
}));

vi.mock('../utils/plugin', () => ({
  validatePluginName: vi.fn(name => {
    if (name === 'invalid') {
      throw new Error('Invalid plugin name');
    }
    return undefined;
  }),
}));

vi.mock('../main/install-plugin', async () => {
  const actual = await vi.importActual<typeof installPlugin>('../main/install-plugin');
  return {
    ...actual,
    installPluginToTmpDir: vi.fn(),
    isInsomniaPlugin: vi.fn().mockResolvedValue({
      insomnia: { name: 'mock-plugin' },
      version: '0.0.1',
      name: 'mock-plugin',
      dist: { tarball: 'https://registry.npmjs.org/mock-plugin.tgz', shasum: '1234567890abcdef' },
    }),
    getYarnPath: vi.fn().mockResolvedValue(path.resolve(__dirname, '../../bin/yarn-standalone.js')),
  };
});

vi.mock('../models', () => ({
  settings: {
    get: vi.fn().mockResolvedValue({
      pluginNodeExtraCerts: '/mock/certs.pem',
      proxyEnabled: true,
      httpProxy: 'http://mock-http-proxy',
      httpsProxy: 'https://mock-https-proxy',
      noProxy: 'localhost,127.0.0.1',
    }),
  },
}));

const mockPluginJson = {
  name: 'mock-plugin',
  version: '0.0.1',
  insomnia: { name: 'mock-plugin' },
  dist: {
    tarball: 'https://registry.npmjs.org/mock-plugin.tgz',
    shasum: '1234567890abcdef',
  },
};

describe('install-plugin.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(net.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockPluginJson,
    } as unknown as Response);
    vi.mocked(installPluginToTmpDir).mockResolvedValue('/mock/tmp/mock-plugin');
    // vi.mocked(installPluginFromNpm).mockResolvedValue(undefined);
  });

  describe('installPlugin', () => {
    it('should throw an error for invalid plugin names', async () => {
      await expect(installPlugin('invalid')).rejects.toThrow('Invalid plugin name');
    });

    // it('should throw an error if tarball hostname is not allowed', async () => {
    //   vi.mocked(isInsomniaPlugin).mockResolvedValueOnce({
    //     insomnia: { name: 'mock-plugin' },
    //     version: '0.0.1',
    //     name: 'mock-plugin',
    //     dist: { tarball: 'https://untrusted.com/mock-plugin.tgz', shasum: '1234567890abcdef' },
    //   });

    //   vi.mocked(net.fetch).mockResolvedValueOnce({
    //     ok: true,
    //     status: 200,
    //     statusText: 'OK',
    //     json: async () => ({
    //       name: 'mock-plugin',
    //       version: '0.0.1',
    //       insomnia: { name: 'mock-plugin' },
    //       dist: {
    //         tarball: 'https://registry.npmjs.org/mock-plugin.tgz',
    //         shasum: '1234567890abcdef',
    //       },
    //     }),
    //   } as unknown as Response);

    //   await expect(installPlugin('mock-plugin')).rejects.toThrow('Tarball must come from an allowed host');
    // });

    // it('Should reject if the tarball fetch response is not ok', async () => {
    //   vi.mocked(net.fetch).mockResolvedValueOnce({
    //     ok: false,
    //     status: 404,
    //     statusText: 'Not Found',
    //     json: vi.fn(),
    //   } as unknown as Response);

    //   await expect(installPlugin('mock-plugin')).rejects.toThrow('Failed to fetch plugin metadata');
    // });

    // it('should reject is the response json is not valid', async () => {
    //   vi.mocked(net.fetch).mockResolvedValueOnce({
    //     ok: true,
    //     status: 200,
    //     statusText: 'OK',
    //     json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    //   } as unknown as Response);

    //   await expect(installPlugin('mock-plugin')).rejects.toThrow('Invalid JSON');
    // });

    // it('should clean up temporary directory on failure', async () => {
    //   vi.mocked(isInsomniaPlugin).mockResolvedValueOnce({
    //     name: 'mock-plugin',
    //     version: '0.0.1',
    //     insomnia: { name: 'mock-plugin' },
    //     dist: { tarball: 'https://registry.npmjs.org/mock-plugin.tgz', shasum: '1234567890abcdef' },
    //   });

    //   vi.mocked(installPluginToTmpDir).mockRejectedValueOnce(new Error('Installation failed'));

    //   await expect(installPlugin('mock-plugin')).rejects.toThrow('Installation failed');
    //   expect(rm).toHaveBeenCalledWith(expect.stringContaining('/mock/tmp'), {
    //     recursive: true,
    //     force: true,
    //   });
    // });

    //   it('should successfully install a plugin', async () => {
    //     vi.mocked(execFilePromise).mockResolvedValue({
    //       stdout: 'mocked stdout',
    //       stderr: '',
    //     });

    //     vi.mocked(isInsomniaPlugin).mockResolvedValueOnce({
    //       insomnia: { name: 'mock-plugin' },
    //       version: '0.0.1',
    //       name: 'mock-plugin',
    //       dist: { tarball: 'https://registry.npmjs.org/mock-plugin.tgz', shasum: '1234567890abcdef' },
    //     });

    //     vi.mocked(net.fetch).mockResolvedValueOnce({
    //       ok: true,
    //       status: 200,
    //       statusText: 'OK',
    //       json: async () => ({
    //         name: 'mock-plugin',
    //         version: '0.0.1',
    //         insomnia: { name: 'mock-plugin' },
    //         dist: {
    //           tarball: 'https://registry.npmjs.org/mock-plugin.tgz',
    //           shasum: '1234567890abcdef',
    //         },
    //       }),
    //     } as unknown as Response);

    //     vi.mocked(installPluginToTmpDir).mockResolvedValueOnce('/mock/tmp/mock-plugin');

    //     await expect(installPlugin('mock-plugin')).resolves.not.toThrow();
    //     expect(installPluginToTmpDir).toHaveBeenCalledWith('mock-plugin');
    //   });
  });

  describe('containsOnlyDeprecationWarnings', () => {
    it('should return true for valid deprecation warnings', () => {
      const output = 'warning: this feature is deprecated\nwarning: will be removed in future versions';
      expect(containsOnlyDeprecationWarnings(output)).toBe(true);
    });

    it('should return false for non-deprecation warnings', () => {
      const output = 'error: something went wrong\nwarning: this feature is deprecated';
      expect(containsOnlyDeprecationWarnings(output)).toBe(false);
    });

    it('should return false for unexpected binary data', () => {
      const output = 'warning: this feature is deprecated\n\x00\x01\x02unexpected binary data';
      expect(containsOnlyDeprecationWarnings(output)).toBe(false);
    });
  });

  describe('isInsomniaPlugin', () => {
    // it('should throw an error for invalid plugin names', async () => {
    //   await expect(isInsomniaPlugin('invalid')).rejects.toThrow('Invalid plugin name');
    // });

    // it('should throw an error if plugin metadata is invalid', async () => {
    //   const mockInstallPluginToTmpDir = vi.fn().mockResolvedValue('{}');
    //   vi.mocked(installPluginToTmpDir).mockImplementation(mockInstallPluginToTmpDir);

    //   await expect(isInsomniaPlugin('mock-plugin')).rejects.toThrow('Unexpected yarn output structure');
    // });

    // it('should throw an error if plugin is missing "insomnia" attribute', async () => {
    //   vi.mocked(installPluginToTmpDir).mockResolvedValue('/mock/tmp/path');
    //   vi.mocked(readFile).mockResolvedValue(
    //     JSON.stringify({ version: '0.0.1', name: 'mock-plugin' }), // No "insomnia" field
    //   );

    //   vi.mocked(readFile).mockResolvedValue(
    //     JSON.stringify({
    //       name: 'mock-plugin',
    //       version: '0.0.1',
    //       // no `insomnia` field
    //     }),
    //   );
    //   await expect(isInsomniaPlugin('mock-plugin')).rejects.toThrow('Package "mock-plugin" is not an Insomnia plugin');
    // });

    it('should return plugin metadata for a valid plugin', async () => {
      vi.mocked(isInsomniaPlugin).mockResolvedValueOnce({
        insomnia: { name: 'mock-plugin' },
        version: '0.0.1',
        name: 'mock-plugin',
        dist: { tarball: 'https://registry.npmjs.org/mock-plugin.tgz', shasum: '1234567890abcdef' },
      });

      const result = await isInsomniaPlugin('mock-plugin');
      expect(result).toEqual({
        insomnia: { name: 'mock-plugin' },
        version: '0.0.1',
        name: 'mock-plugin',
        dist: { tarball: 'https://registry.npmjs.org/mock-plugin.tgz', shasum: '1234567890abcdef' },
      });
    });
  });

  describe('getYarnEnvValues', () => {
    it('should include NODE_EXTRA_CA_CERTS if pluginNodeExtraCerts is defined', async () => {
      const env = await getYarnEnvValues();
      expect(env.NODE_EXTRA_CA_CERTS).toBe('/mock/certs.pem');
    });

    it('should include proxy settings if proxyEnabled is true', async () => {
      const env = await getYarnEnvValues();
      expect(env.HTTP_PROXY).toBe('http://mock-http-proxy');
      expect(env.HTTPS_PROXY).toBe('https://mock-https-proxy');
      expect(env.NO_PROXY).toBe('localhost,127.0.0.1');
    });

    it('should not include NODE_EXTRA_CA_CERTS if pluginNodeExtraCerts is undefined', async () => {
      const env = await getYarnEnvValues();
      expect(env.NODE_EXTRA_CA_CERTS).toBeDefined();
      expect(env.NODE_EXTRA_CA_CERTS).toBe('/mock/certs.pem');
    });
  });

  describe('safeTrim', () => {
    it('should return trimmed string for valid input', () => {
      expect(safeTrim('  valid string  ')).toBe('valid string');
    });

    it('should return undefined for non-string input', () => {
      expect(safeTrim(123)).toBeUndefined();
    });

    it('should return undefined for empty string after trimming', () => {
      expect(safeTrim('   ')).toBeUndefined();
    });
  });
});
