import path from 'node:path';

import { app, BrowserWindow } from 'electron';
import { services } from 'insomnia-data';

import { LLM_BACKENDS } from '~/common/constants';
import { AnalyticsEvent, trackAnalyticsEvent } from '~/main/analytics';
import { ipcMainHandle } from '~/main/ipc/electron';

const LLM_PLUGIN_NAME = 'insomnia-llm';

export type LLMBackend = (typeof LLM_BACKENDS)[number];

export interface LLMConfig {
  backend: LLMBackend;
  model: string;
  modelDir?: string;
  apiKey?: string;
  url?: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  sendTemperature?: boolean;
  sendTopP?: boolean;
  sendMaxTokens?: boolean;
  topK?: number;
  seed?: boolean;
  repeatPenalty?: number;
}
export type AIFeatureNames = 'aiMockServers' | 'aiCommitMessages' | 'aiMcpClient';

export const getActiveBackend = async (): Promise<LLMBackend | null> => {
  const active = await services.pluginData.getByKey(LLM_PLUGIN_NAME, 'model.active');
  if (!active) return null;
  return active.value as LLMBackend;
};

export const setActiveBackend = async (backend: LLMBackend): Promise<void> => {
  await services.pluginData.upsertByKey(LLM_PLUGIN_NAME, 'model.active', backend);
};

export const clearActiveBackend = async (): Promise<void> => {
  await services.pluginData.removeByKey(LLM_PLUGIN_NAME, 'model.active');
};

export const getBackendConfig = async (backend: LLMBackend): Promise<Partial<LLMConfig>> => {
  const allData = await services.pluginData.all(LLM_PLUGIN_NAME);
  const backendData = allData.filter(item => item.key.startsWith(`${backend}.`));

  const config: Partial<LLMConfig> = { backend };

  for (const item of backendData) {
    const field = item.key.split('.')[1];
    const value = item.value;

    switch (field) {
      case 'model':
      case 'apiKey':
      case 'url':
      case 'baseURL': {
        config[field] = value;
        break;
      }
      case 'temperature':
      case 'topP':
      case 'topK':
      case 'maxTokens':
      case 'repeatPenalty': {
        config[field] = Number.parseFloat(value);
        break;
      }
      case 'seed': {
        config[field] = value === 'true';
        break;
      }
      case 'sendTemperature':
      case 'sendTopP':
      case 'sendMaxTokens': {
        config[field] = value === 'true';
        break;
      }
      default: {
        break;
      }
    }
  }

  if (backend === 'gguf') {
    const llmDir = path.join(process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'), 'llms');
    config.modelDir = llmDir;
  }

  return config;
};

export const updateBackendConfig = async (backend: LLMBackend, config: Partial<LLMConfig>): Promise<void> => {
  const updates = Object.entries(config).filter(([key]) => key !== 'backend');

  for (const [field, value] of updates) {
    if (value !== undefined && value !== null) {
      await services.pluginData.upsertByKey(LLM_PLUGIN_NAME, `${backend}.${field}`, String(value));
    }
  }
};

export const getAllConfigurations = async (): Promise<LLMConfig[]> => {
  const configs = await Promise.all(
    LLM_BACKENDS.map(
      async backend =>
        ({
          ...(await getBackendConfig(backend)),
          backend,
        }) as LLMConfig,
    ),
  );

  return configs.filter(config => config.model || config.apiKey || config.url);
};

export const getCurrentConfig = async (): Promise<LLMConfig | null> => {
  const activeBackend = await getActiveBackend();
  if (!activeBackend) return null;

  const config = await getBackendConfig(activeBackend);
  return { ...config, backend: activeBackend } as LLMConfig;
};

export const getAIFeatureEnabled = async (feature: AIFeatureNames): Promise<boolean> => {
  const data = await services.pluginData.getByKey(LLM_PLUGIN_NAME, `feature.${feature}`);
  return data?.value === 'true';
};

export const setAIFeatureEnabled = async (feature: AIFeatureNames, enabled: boolean): Promise<void> => {
  await services.pluginData.upsertByKey(LLM_PLUGIN_NAME, `feature.${feature}`, String(enabled));

  trackAnalyticsEvent(enabled ? AnalyticsEvent.aiFeatureEnabled : AnalyticsEvent.aiFeatureDisabled, {
    feature: feature,
    set_for: 'user',
  });
};

export interface LLMConfigServiceAPI {
  getActiveBackend: typeof getActiveBackend;
  setActiveBackend: typeof setActiveBackend;
  clearActiveBackend: typeof clearActiveBackend;
  getBackendConfig: typeof getBackendConfig;
  updateBackendConfig: typeof updateBackendConfig;
  getAllConfigurations: typeof getAllConfigurations;
  getCurrentConfig: typeof getCurrentConfig;
  getAIFeatureEnabled: typeof getAIFeatureEnabled;
  setAIFeatureEnabled: typeof setAIFeatureEnabled;
}

// Notify every renderer that the LLM config or AI feature flags changed so that
// any mounted consumer (e.g. `useAIFeatureStatus`) re-reads the latest values.
// Main owns the data, so it also owns the change signal — this keeps every
// window consistent instead of only the one that performed the mutation.
const broadcastLLMChanged = () => {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('llm.changed');
  }
};

export const registerLLMConfigServiceAPI = () => {
  ipcMainHandle('llm.getActiveBackend', async () => getActiveBackend());
  ipcMainHandle('llm.setActiveBackend', async (_, backend: LLMBackend) => {
    await setActiveBackend(backend);
    broadcastLLMChanged();
  });
  ipcMainHandle('llm.clearActiveBackend', async () => {
    await clearActiveBackend();
    broadcastLLMChanged();
  });
  ipcMainHandle('llm.getBackendConfig', async (_, backend: LLMBackend) => getBackendConfig(backend));
  ipcMainHandle('llm.updateBackendConfig', async (_, backend: LLMBackend, config: Partial<LLMConfig>) => {
    await updateBackendConfig(backend, config);
    broadcastLLMChanged();
  });
  ipcMainHandle('llm.getAllConfigurations', async () => getAllConfigurations());
  ipcMainHandle('llm.getCurrentConfig', async () => getCurrentConfig());
  ipcMainHandle('llm.getAIFeatureEnabled', async (_, feature: AIFeatureNames) => getAIFeatureEnabled(feature));
  ipcMainHandle('llm.setAIFeatureEnabled', async (_, feature: AIFeatureNames, enabled: boolean) => {
    await setAIFeatureEnabled(feature, enabled);
    broadcastLLMChanged();
  });
};
