import { beforeEach, describe, expect, it, vi } from 'vitest';

import { services } from '~/insomnia-data';

import {
  clearActiveBackend,
  getActiveBackend,
  getAllConfigurations,
  getBackendConfig,
  setActiveBackend,
  updateBackendConfig,
} from '../llm-config-service';

vi.mock('~/insomnia-data', async importOriginal => {
  return {
    services: {
      pluginData: {
        getByKey: vi.fn(),
        upsertByKey: vi.fn(),
        removeByKey: vi.fn(),
        all: vi.fn(),
      },
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  net: {
    fetch: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('@sentry/electron/main', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

const mockPluginData = (key: string, value: string) => ({ key, value }) as any;

describe('llm-config-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(services.pluginData.all).mockResolvedValue([]);
    vi.mocked(services.pluginData.getByKey).mockResolvedValue(null as any);
  });

  describe('getBackendConfig()', () => {
    it('should retrieve url field from storage', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([
        mockPluginData('url.model', 'gpt-4'),
        mockPluginData('url.url', 'https://api.example.com/v1'),
      ]);

      const config = await getBackendConfig('url');

      expect(config).toEqual({
        backend: 'url',
        model: 'gpt-4',
        url: 'https://api.example.com/v1',
      });
    });

    it('should retrieve baseURL field from storage', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([
        mockPluginData('url.model', 'claude-3'),
        mockPluginData('url.baseURL', 'https://custom-llm.com'),
      ]);

      const config = await getBackendConfig('url');

      expect(config).toEqual({
        backend: 'url',
        model: 'claude-3',
        baseURL: 'https://custom-llm.com',
      });
    });

    it('should handle both url and baseURL fields', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([
        mockPluginData('url.url', 'https://api.example.com/v1'),
        mockPluginData('url.baseURL', 'https://base.example.com'),
        mockPluginData('url.model', 'test-model'),
      ]);

      const config = await getBackendConfig('url');

      expect(config.url).toBe('https://api.example.com/v1');
      expect(config.baseURL).toBe('https://base.example.com');
      expect(config.model).toBe('test-model');
    });

    it('should return empty config for unconfigured backend', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([]);

      const config = await getBackendConfig('url');

      expect(config).toEqual({
        backend: 'url',
      });
    });
  });

  describe('updateBackendConfig()', () => {
    it('should save url field to storage', async () => {
      await updateBackendConfig('url', {
        url: 'https://api.example.com/v1',
        model: 'gpt-4',
      });

      expect(services.pluginData.upsertByKey).toHaveBeenCalledWith(
        'insomnia-llm',
        'url.url',
        'https://api.example.com/v1',
      );
      expect(services.pluginData.upsertByKey).toHaveBeenCalledWith('insomnia-llm', 'url.model', 'gpt-4');
    });

    it('should save baseURL field to storage', async () => {
      await updateBackendConfig('url', {
        baseURL: 'https://custom-llm.com',
        model: 'claude-3',
      });

      expect(services.pluginData.upsertByKey).toHaveBeenCalledWith(
        'insomnia-llm',
        'url.baseURL',
        'https://custom-llm.com',
      );
    });

    it('should handle partial config updates', async () => {
      await updateBackendConfig('url', {
        url: 'https://new-url.com/v1',
      });

      expect(services.pluginData.upsertByKey).toHaveBeenCalledWith('insomnia-llm', 'url.url', 'https://new-url.com/v1');
      expect(services.pluginData.upsertByKey).toHaveBeenCalledTimes(1);
    });

    it('should not save backend field', async () => {
      await updateBackendConfig('url', {
        backend: 'url',
        url: 'https://api.example.com/v1',
      });

      const calls = vi.mocked(services.pluginData.upsertByKey).mock.calls;
      const backendFieldCall = calls.find(call => call[1] === 'url.backend');
      expect(backendFieldCall).toBeUndefined();
    });
  });

  describe('getAllConfigurations()', () => {
    it('should include url backend in configurations', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([
        mockPluginData('url.model', 'gpt-4'),
        mockPluginData('url.url', 'https://api.example.com/v1'),
        mockPluginData('gguf.model', 'llama-3'),
      ]);

      const configs = await getAllConfigurations();

      const urlConfig = configs.find(c => c.backend === 'url');
      expect(urlConfig).toBeDefined();
      expect(urlConfig?.url).toBe('https://api.example.com/v1');
      expect(urlConfig?.model).toBe('gpt-4');
    });

    it('should filter out unconfigured backends', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([
        mockPluginData('claude.model', 'claude-3-opus'),
        mockPluginData('claude.apiKey', 'sk-ant-123'),
      ]);

      const configs = await getAllConfigurations();

      // Should only return claude since it's the only one configured
      expect(configs).toHaveLength(1);
      expect(configs[0].backend).toBe('claude');
    });

    it('should include backend with only url field set', async () => {
      vi.mocked(services.pluginData.all).mockResolvedValue([mockPluginData('url.url', 'https://api.example.com/v1')]);

      const configs = await getAllConfigurations();

      const urlConfig = configs.find(c => c.backend === 'url');
      expect(urlConfig).toBeDefined();
      expect(urlConfig?.url).toBe('https://api.example.com/v1');
    });
  });

  describe('Active backend management', () => {
    it('should set url as active backend', async () => {
      await setActiveBackend('url');

      expect(services.pluginData.upsertByKey).toHaveBeenCalledWith('insomnia-llm', 'model.active', 'url');
    });

    it('should get url as active backend', async () => {
      vi.mocked(services.pluginData.getByKey).mockResolvedValue({ value: 'url' } as any);

      const active = await getActiveBackend();

      expect(active).toBe('url');
    });

    it('should return null when no active backend', async () => {
      vi.mocked(services.pluginData.getByKey).mockResolvedValue(null as any);

      const active = await getActiveBackend();

      expect(active).toBeNull();
    });

    it('should clear active backend', async () => {
      await clearActiveBackend();

      expect(services.pluginData.removeByKey).toHaveBeenCalledWith('insomnia-llm', 'model.active');
    });
  });
});
