import { describe, expect, it } from 'vitest';

import {
  DEFAULT_URL_MODEL_PARAMETERS,
  getUrlActivateSettingsPayload,
  getUrlAuthHeaders,
  getUrlLoadModelsSettingsPayload,
  getUrlModelParametersFromConfig,
  hasUrlModelParameterChanges,
  isUrlActivateDisabled,
  urlModelParametersSchema,
} from './url-utils';

describe('url-utils', () => {
  describe('getUrlModelParametersFromConfig()', () => {
    it('returns defaults for empty config', () => {
      expect(getUrlModelParametersFromConfig()).toEqual(DEFAULT_URL_MODEL_PARAMETERS);
    });

    it('returns defaults for null config', () => {
      expect(getUrlModelParametersFromConfig(null)).toEqual(DEFAULT_URL_MODEL_PARAMETERS);
    });

    it('prefers configured values and falls back for missing fields', () => {
      expect(
        getUrlModelParametersFromConfig({
          temperature: 0.75,
          topP: 0.8,
        }),
      ).toEqual({
        temperature: 0.75,
        topP: 0.8,
        maxTokens: DEFAULT_URL_MODEL_PARAMETERS.maxTokens,
      });
    });
  });

  describe('urlModelParametersSchema', () => {
    it('accepts valid values', () => {
      const result = urlModelParametersSchema.safeParse({
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
      });
      expect(result.success).toBe(true);
    });

    it('rejects out-of-range values', () => {
      const result = urlModelParametersSchema.safeParse({
        temperature: 2.5,
        topP: 1.2,
        maxTokens: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('hasUrlModelParameterChanges()', () => {
    it('returns false when parameters match current config', () => {
      const currentConfig = {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
      };
      expect(hasUrlModelParameterChanges(currentConfig, getUrlModelParametersFromConfig(currentConfig))).toBe(false);
    });

    it('returns true when parameters differ from current config', () => {
      const currentConfig = {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
      };
      expect(
        hasUrlModelParameterChanges(currentConfig, {
          temperature: 0.8,
          topP: 0.85,
          maxTokens: 2048,
        }),
      ).toBe(true);
    });
  });

  describe('getUrlAuthHeaders()', () => {
    it('returns undefined when API token is empty or whitespace', () => {
      expect(getUrlAuthHeaders('')).toBeUndefined();
      expect(getUrlAuthHeaders('   ')).toBeUndefined();
    });

    it('returns bearer Authorization header with trimmed token', () => {
      expect(getUrlAuthHeaders('  sk-test  ')).toEqual({
        Authorization: 'Bearer sk-test',
      });
    });
  });

  describe('settings payload helpers', () => {
    it('builds load-models payload with all URL model properties', () => {
      const payload = getUrlLoadModelsSettingsPayload('https://example.com/v1', '  token-1  ', {
        temperature: 1.1,
        topP: 0.8,
        maxTokens: 1024,
      });

      expect(payload).toEqual({
        url: 'https://example.com/v1',
        apiKey: 'token-1',
        temperature: 1.1,
        topP: 0.8,
        maxTokens: 1024,
      });
    });

    it('builds activate payload with all URL model properties', () => {
      const payload = getUrlActivateSettingsPayload('https://example.com/v1', 'gpt-test', '  token-2  ', {
        temperature: 0.7,
        topP: 0.95,
        maxTokens: 2048,
      });

      expect(payload).toEqual({
        url: 'https://example.com/v1',
        model: 'gpt-test',
        apiKey: 'token-2',
        temperature: 0.7,
        topP: 0.95,
        maxTokens: 2048,
      });
    });
  });

  describe('isUrlActivateDisabled()', () => {
    it('enables activate for active URL backend with model selected and changes, even without reloaded models', () => {
      expect(
        isUrlActivateDisabled({
          hasLoadedModels: false,
          isCurrentBackend: true,
          selectedModel: 'gpt-test',
          hasChanges: true,
        }),
      ).toBe(false);
    });

    it('disables activate for inactive backend when models have not been loaded', () => {
      expect(
        isUrlActivateDisabled({
          hasLoadedModels: false,
          isCurrentBackend: false,
          selectedModel: 'gpt-test',
          hasChanges: true,
        }),
      ).toBe(true);
    });

    it('disables activate when no model is selected', () => {
      expect(
        isUrlActivateDisabled({
          hasLoadedModels: true,
          isCurrentBackend: true,
          selectedModel: '',
          hasChanges: true,
        }),
      ).toBe(true);
    });

    it('disables activate when active backend has no changes', () => {
      expect(
        isUrlActivateDisabled({
          hasLoadedModels: true,
          isCurrentBackend: true,
          selectedModel: 'gpt-test',
          hasChanges: false,
        }),
      ).toBe(true);
    });
  });
});
