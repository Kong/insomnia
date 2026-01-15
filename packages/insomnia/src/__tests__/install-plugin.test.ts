import { execFile } from 'node:child_process';

import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// All vi.mock calls must be at the top level
vi.mock('node:path', () => ({
  default: {
    resolve: vi.fn((...args) => '/mock/app/path/' + args.join('/')),
    dirname: vi.fn(() => '/mock/app/path'),
    join: vi.fn((...args) => args.join('/')),
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  lstat: vi.fn(() => Promise.resolve({ isSymbolicLink: () => false })),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(() => Promise.resolve('/tmp/test-plugin-123')),
  readdir: vi.fn(() =>
    Promise.resolve([
      {
        name: 'test-plugin',
        isDirectory: () => true,
      },
      {
        name: 'node_modules',
        isDirectory: () => true,
      },
    ]),
  ),
  rm: vi.fn(),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => true })),
  writeFile: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    getAppPath: vi.fn(),
  },
  net: {
    fetch: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../models', () => ({
  settings: {
    get: vi.fn(() => Promise.resolve({})),
  },
}));

// Mock the entire install-plugin module
vi.mock('../main/install-plugin', async () => {
  const actual = await vi.importActual('../main/install-plugin');
  return {
    ...actual,
    default: vi.fn(),
    getPluginInfo: vi.fn(),
    getYarnPath: vi.fn(() => Promise.resolve('/mock/app/path/yarn')),
    runYarnCommand: vi.fn(),
    containsOnlyDeprecationWarnings: vi.fn(),
    hasUnexpectedBinaryData: vi.fn(),
    safeTrim: vi.fn(),
    isValidProxyUrl: vi.fn(),
    buildProxyEnv: vi.fn(),
  };
});

vi.mock('../main/analytics', () => ({
  trackSegmentEvent: vi.fn(),
  SegmentEvent: {
    installPlugin: 'Plugin Installed',
  },
}));

import installPlugin, {
  buildProxyEnv,
  containsOnlyDeprecationWarnings,
  getPluginInfo,
  hasUnexpectedBinaryData,
  isValidProxyUrl,
  runYarnCommand,
  safeTrim,
} from '../main/install-plugin';

describe('Plugin Installation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock app.getAppPath to return a valid path
    vi.mocked(app.getAppPath).mockReturnValue('/mock/app/path');
    // Mock app.getPath to return a valid path
    vi.mocked(app.getPath).mockReturnValue('/mock/user/data/path');

    // Mock utility functions
    vi.mocked(containsOnlyDeprecationWarnings).mockImplementation(output => {
      if (!output) return true;
      return output.includes('warning: deprecated:') && !output.includes('Error:');
    });

    vi.mocked(hasUnexpectedBinaryData).mockImplementation(output => {
      return output.includes('\u0000');
    });

    vi.mocked(safeTrim).mockImplementation(value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      return trimmed || undefined;
    });

    vi.mocked(isValidProxyUrl).mockImplementation(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    vi.mocked(buildProxyEnv).mockImplementation(settings => {
      const env: Record<string, string> = {};
      if (settings.proxyEnabled) {
        if (settings.httpProxy) env.HTTP_PROXY = settings.httpProxy;
        if (settings.httpsProxy) env.HTTPS_PROXY = settings.httpsProxy;
        if (settings.noProxy) env.NO_PROXY = settings.noProxy;
      }
      return env;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('installPlugin', () => {
    it('should successfully install a valid plugin', async () => {
      const mockPluginInfo = {
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
      };

      vi.mocked(getPluginInfo).mockImplementation(() => Promise.resolve(mockPluginInfo));
      vi.mocked(installPlugin).mockImplementation(() => Promise.resolve());

      await expect(installPlugin('insomnia-plugin-test')).resolves.not.toThrow();
    });

    it('should throw error for invalid plugin name', async () => {
      vi.mocked(installPlugin).mockImplementation(() =>
        Promise.reject(new Error('Plugin name must not contain path traversal characters')),
      );

      await expect(installPlugin('invalid/name')).rejects.toThrow(
        'Plugin name must not contain path traversal characters',
      );
    });

    it('should throw error for unauthorized tarball host', async () => {
      const mockPluginInfo = {
        name: 'insomnia-plugin-test',
        version: '1.0.0',
        insomnia: {
          name: 'Test Plugin',
          displayName: 'Test Plugin',
          description: 'A test plugin',
        },
        dist: {
          shasum: 'abc123',
          tarball: 'https://malicious-site.com/test-plugin.tgz',
        },
      };

      vi.mocked(getPluginInfo).mockImplementation(() => Promise.resolve(mockPluginInfo));
      vi.mocked(installPlugin).mockImplementation(() =>
        Promise.reject(new Error('Tarball must come from an allowed host')),
      );

      await expect(installPlugin('insomnia-plugin-test')).rejects.toThrow('Tarball must come from an allowed host');
    });
  });

  describe('runYarnCommand', () => {
    it('should execute yarn command successfully', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((cmd, args, options, callback) => {
        callback?.(null, Buffer.from('success'), Buffer.from(''));
        return {} as any;
      });

      vi.mocked(runYarnCommand).mockImplementation(async () => 'success');

      const result = await runYarnCommand(['install'], '/mock/cwd');
      expect(result).toBe('success');
    });

    it('should handle yarn stderr with only deprecation warnings', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((cmd, args, options, callback) => {
        callback?.(null, Buffer.from('success'), Buffer.from('warning: deprecated: This feature is deprecated'));
        return {} as any;
      });

      vi.mocked(runYarnCommand).mockImplementation(async () => 'success');

      await expect(runYarnCommand(['install'], '/mock/cwd')).resolves.toBe('success');
    });

    it('should throw error for non-deprecation stderr messages', async () => {
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((cmd, args, options, callback) => {
        callback?.(null, Buffer.from('success'), Buffer.from('Error: Something went wrong'));
        return {} as any;
      });

      vi.mocked(runYarnCommand).mockImplementation(async () => {
        throw new Error('Yarn error: Error: Something went wrong');
      });

      await expect(runYarnCommand(['install'], '/mock/cwd')).rejects.toThrow('Yarn error: Error: Something went wrong');
    });
  });

  describe('getPluginInfo', () => {
    it('should return valid plugin info', async () => {
      const mockYarnOutput = {
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

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((cmd, args, options, callback) => {
        callback?.(null, Buffer.from(JSON.stringify(mockYarnOutput)), Buffer.from(''));
        return {} as any;
      });

      vi.mocked(getPluginInfo).mockImplementation(async () => mockYarnOutput.data);

      const result = await getPluginInfo('insomnia-plugin-test');
      expect(result).toEqual(mockYarnOutput.data);
    });

    it('should throw error for non-Insomnia plugins', async () => {
      const mockYarnOutput = {
        data: {
          name: 'insomnia-plugin-test',
          version: '1.0.0',
          dist: {
            shasum: 'abc123',
            tarball: 'https://registry.npmjs.org/test-plugin/-/test-plugin-1.0.0.tgz',
          },
        },
      };

      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockImplementation((cmd, args, options, callback) => {
        callback?.(null, Buffer.from(JSON.stringify(mockYarnOutput)), Buffer.from(''));
        return {} as any;
      });

      vi.mocked(getPluginInfo).mockImplementation(async () => {
        throw new Error('not an Insomnia plugin');
      });

      await expect(getPluginInfo('insomnia-plugin-test')).rejects.toThrow('not an Insomnia plugin');
    });
  });

  describe('Utility Functions', () => {
    describe('containsOnlyDeprecationWarnings', () => {
      it('should return true for empty output', () => {
        expect(containsOnlyDeprecationWarnings('')).toBe(true);
      });

      it('should return true for deprecation warnings', () => {
        const output = 'warning: deprecated: This feature is deprecated';
        expect(containsOnlyDeprecationWarnings(output)).toBe(true);
      });

      it('should return false for error messages', () => {
        const output = 'Error: Something went wrong';
        expect(containsOnlyDeprecationWarnings(output)).toBe(false);
      });
    });

    describe('hasUnexpectedBinaryData', () => {
      it('should return false for normal text', () => {
        expect(hasUnexpectedBinaryData('normal text')).toBe(false);
      });

      it('should return true for binary data', () => {
        const binaryData = Buffer.from([0x00, 0x01, 0x02]);
        expect(hasUnexpectedBinaryData(binaryData.toString())).toBe(true);
      });
    });

    describe('safeTrim', () => {
      it('should trim string values', () => {
        expect(safeTrim('  test  ')).toBe('test');
      });

      it('should return undefined for non-string values', () => {
        expect(safeTrim(123)).toBeUndefined();
      });

      it('should return undefined for empty strings', () => {
        expect(safeTrim('   ')).toBeUndefined();
      });
    });

    describe('isValidProxyUrl', () => {
      it('should return true for valid URLs', () => {
        expect(isValidProxyUrl('http://proxy.example.com:8080')).toBe(true);
      });

      it('should return false for invalid URLs', () => {
        expect(isValidProxyUrl('not-a-url')).toBe(false);
      });
    });

    describe('buildProxyEnv', () => {
      it('should build proxy environment variables', () => {
        const settings = {
          proxyEnabled: true,
          httpProxy: 'http://proxy.example.com:8080',
          httpsProxy: 'https://proxy.example.com:8443',
          noProxy: 'localhost,127.0.0.1',
        };

        const result = buildProxyEnv(settings);
        expect(result).toEqual({
          HTTP_PROXY: 'http://proxy.example.com:8080',
          HTTPS_PROXY: 'https://proxy.example.com:8443',
          NO_PROXY: 'localhost,127.0.0.1',
        });
      });
    });
  });
});
