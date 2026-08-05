import z from 'zod/v4';

import type { LLMConfig } from '~/main/llm-config-service';

export const urlModelParametersSchema = z.object({
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().int().min(1).max(128_000),
  sendTemperature: z.boolean(),
  sendTopP: z.boolean(),
  sendMaxTokens: z.boolean(),
});

export type UrlModelParameters = z.infer<typeof urlModelParametersSchema>;

export const DEFAULT_URL_MODEL_PARAMETERS: UrlModelParameters = {
  temperature: 0.6,
  topP: 0.9,
  maxTokens: 8192,
  sendTemperature: true,
  sendTopP: true,
  sendMaxTokens: true,
};

export const getUrlModelParametersFromConfig = (config?: Partial<LLMConfig> | null): UrlModelParameters => ({
  temperature: config?.temperature ?? DEFAULT_URL_MODEL_PARAMETERS.temperature,
  topP: config?.topP ?? DEFAULT_URL_MODEL_PARAMETERS.topP,
  maxTokens: config?.maxTokens ?? DEFAULT_URL_MODEL_PARAMETERS.maxTokens,
  sendTemperature: config?.sendTemperature ?? DEFAULT_URL_MODEL_PARAMETERS.sendTemperature,
  sendTopP: config?.sendTopP ?? DEFAULT_URL_MODEL_PARAMETERS.sendTopP,
  sendMaxTokens: config?.sendMaxTokens ?? DEFAULT_URL_MODEL_PARAMETERS.sendMaxTokens,
});

export const hasUrlModelParameterChanges = (
  currentConfig: Partial<LLMConfig> | null,
  modelParameters: UrlModelParameters,
): boolean => {
  const current = getUrlModelParametersFromConfig(currentConfig);
  return (
    modelParameters.temperature !== current.temperature ||
    modelParameters.topP !== current.topP ||
    modelParameters.maxTokens !== current.maxTokens ||
    modelParameters.sendTemperature !== current.sendTemperature ||
    modelParameters.sendTopP !== current.sendTopP ||
    modelParameters.sendMaxTokens !== current.sendMaxTokens
  );
};

export const getUrlAuthHeaders = (apiKey: string): Record<string, string> | undefined => {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${trimmedApiKey}`,
  };
};

export const getUrlLoadModelsSettingsPayload = (
  url: string,
  apiKey: string,
  modelParameters: UrlModelParameters,
): Partial<LLMConfig> => ({
  url,
  apiKey: apiKey.trim(),
  maxTokens: modelParameters.maxTokens,
  temperature: modelParameters.temperature,
  topP: modelParameters.topP,
  sendMaxTokens: modelParameters.sendMaxTokens,
  sendTemperature: modelParameters.sendTemperature,
  sendTopP: modelParameters.sendTopP,
});

export const getUrlActivateSettingsPayload = (
  url: string,
  selectedModel: string,
  apiKey: string,
  modelParameters: UrlModelParameters,
): Partial<LLMConfig> => ({
  url,
  model: selectedModel,
  apiKey: apiKey.trim(),
  maxTokens: modelParameters.maxTokens,
  temperature: modelParameters.temperature,
  topP: modelParameters.topP,
  sendMaxTokens: modelParameters.sendMaxTokens,
  sendTemperature: modelParameters.sendTemperature,
  sendTopP: modelParameters.sendTopP,
});

export const isUrlActivateDisabled = ({
  hasLoadedModels,
  isCurrentBackend,
  selectedModel,
  hasChanges,
}: {
  hasLoadedModels: boolean;
  isCurrentBackend: boolean;
  selectedModel: string;
  hasChanges: boolean;
}) => {
  return (!hasLoadedModels && !isCurrentBackend) || !selectedModel || (isCurrentBackend && !hasChanges);
};
