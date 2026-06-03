import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Input, Text } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Icon } from '~/ui/components/icon';
import {
  DEFAULT_URL_MODEL_PARAMETERS,
  getUrlActivateSettingsPayload,
  getUrlAuthHeaders,
  getUrlLoadModelsSettingsPayload,
  getUrlModelParametersFromConfig,
  hasUrlModelParameterChanges,
  isUrlActivateDisabled,
  type UrlModelParameters,
  urlModelParametersSchema,
} from '~/ui/components/settings/llms/url-utils';

const URL_BACKEND: LLMBackend = 'url';

interface LLMModelData {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

const validateUrl = (urlString: string): boolean => {
  if (!urlString) {
    return false;
  }
  try {
    const parsedUrl = new URL(urlString);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

export const Url = ({
  saveLLMSettings,
  configuredLLMs,
  currentLLM,
  deactivateCurrentLLM,
}: {
  currentLLM: LLMConfig | null;
  saveLLMSettings: (setCurrent: boolean, backend: LLMBackend, extras?: Partial<LLMConfig>) => void;
  deactivateCurrentLLM: () => Promise<void>;
  configuredLLMs: LLMConfig[];
}) => {
  const urlId = useId();
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelParameters, setModelParameters] = useState<UrlModelParameters>({ ...DEFAULT_URL_MODEL_PARAMETERS });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [hasHydratedFromConfig, setHasHydratedFromConfig] = useState(false);

  const hasChanges = useMemo(() => {
    const parametersChanged = hasUrlModelParameterChanges(currentLLM, modelParameters);

    return (
      url !== currentLLM?.url ||
      selectedModel !== currentLLM?.model ||
      apiKey !== (currentLLM?.apiKey || '') ||
      parametersChanged
    );
  }, [url, selectedModel, currentLLM, apiKey, modelParameters]);

  const fetchAvailableModels = useCallback(
    async (urlOverride?: string) => {
      const realUrl = urlOverride || url;
      const realApiKey = apiKey.trim();
      const previousSelectedModel = selectedModel;
      const activeModel = currentLLM?.backend === URL_BACKEND ? currentLLM.model : '';

      setAvailableModels([]);
      setSelectedModel('');

      if (!validateUrl(realUrl)) {
        setError('Please enter a valid HTTP or HTTPS URL.');
        return;
      }

      try {
        setIsLoadingModels(true);
        setError(null);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        try {
          const modelsUrl = new URL('models', realUrl.endsWith('/') ? realUrl : `${realUrl}/`);
          const response = await fetch(modelsUrl, {
            headers: getUrlAuthHeaders(realApiKey),
            signal: controller.signal,
          });
          if (!response.ok) {
            if (response.status === 400 || response.status === 401 || response.status === 403) {
              setError('Failed to authenticate with the LLM URL.');
            } else {
              setError('Failed to load models. Please try again.');
            }
            return;
          }
          let data: any;
          try {
            data = await response.json();
          } catch {
            setError('Invalid response from server. Expected JSON.');
            return;
          }

          if (!data?.data?.length) {
            setError('No models found at this URL.');
            return;
          }

          const models = (data.data as LLMModelData[]).filter(model => model.object === 'model');
          if (models.length === 0) {
            setError('No compatible models found at this URL.');
            return;
          }
          const nextSelectedModel = [previousSelectedModel, activeModel].find(
            modelId => !!modelId && modelId !== 'default' && models.some(model => model.id === modelId),
          );
          setAvailableModels(models);
          setSelectedModel(nextSelectedModel || '');
          saveLLMSettings(false, URL_BACKEND, getUrlLoadModelsSettingsPayload(realUrl, realApiKey, modelParameters));
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        if (error instanceof DOMException && error.name === 'AbortError') {
          setError('Request timed out. Please check the URL and try again.');
        } else {
          setError('Network error. Please check your connection and try again.');
        }
      } finally {
        setIsLoadingModels(false);
      }
    },
    [saveLLMSettings, url, apiKey, modelParameters, selectedModel, currentLLM],
  );

  useEffect(() => {
    if (hasHydratedFromConfig && currentLLM?.backend === URL_BACKEND) {
      return;
    }

    if (configuredLLMs.length > 0) {
      if (configuredLLMs[0].url) {
        setUrl(configuredLLMs[0].url);
      }
      if (configuredLLMs[0].model) {
        setSelectedModel(configuredLLMs[0].model === 'default' ? '' : configuredLLMs[0].model);
      }
      setApiKey(configuredLLMs[0].apiKey || '');
      setModelParameters(getUrlModelParametersFromConfig(configuredLLMs[0]));
    }
    // Also check currentLLM
    if (currentLLM?.backend === URL_BACKEND) {
      if (currentLLM.url) {
        setUrl(currentLLM.url);
      }
      if (currentLLM.model) {
        setSelectedModel(currentLLM.model === 'default' ? '' : currentLLM.model);
      }
      setApiKey(currentLLM.apiKey || '');
      setModelParameters(getUrlModelParametersFromConfig(currentLLM));
    }
    setHasHydratedFromConfig(true);
  }, [configuredLLMs, currentLLM, hasHydratedFromConfig]);

  const modelsId = useId();
  const apiKeyId = useId();
  const temperatureId = useId();
  const topPId = useId();
  const maxTokensId = useId();

  const hasExplicitSelectedModel = selectedModel !== '' && selectedModel !== 'default';

  const handleActivate = () => {
    setError(null);

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    if (!hasExplicitSelectedModel) {
      setError('Please select a model.');
      return;
    }

    const validationResult = urlModelParametersSchema.safeParse(modelParameters);
    if (!validationResult.success) {
      setError('Please verify advanced options values.');
      return;
    }

    saveLLMSettings(
      true,
      URL_BACKEND,
      getUrlActivateSettingsPayload(url, selectedModel, apiKey, modelParameters) as Partial<LLMConfig>,
    );
  };

  const isCurrentBackend = currentLLM?.backend === URL_BACKEND;
  const hasLoadedModels = availableModels.length > 0;
  const showActiveModel = isCurrentBackend && !hasLoadedModels;
  const showModelSelector = hasLoadedModels;
  const showActionButtons = hasLoadedModels || isCurrentBackend;
  const activateDisabled = isUrlActivateDisabled({
    hasLoadedModels,
    isCurrentBackend,
    selectedModel: hasExplicitSelectedModel ? selectedModel : '',
    hasChanges,
  });

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="form-control form-control--outlined">
        <label htmlFor={urlId}>LLM URL</label>
        <p className="text-xs text-(--hl)">Specify a URL to a public or self-hosted LLM endpoint.</p>
        <div className="flex flex-row gap-2">
          <Input
            id={urlId}
            type="text"
            placeholder="https://your-llm.example/v1"
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              setAvailableModels([]);
              setSelectedModel('');
            }}
          />
          <Button
            className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
            isDisabled={isLoadingModels || !url}
            onPress={() => fetchAvailableModels()}
          >
            {isLoadingModels ? (
              <span className="flex items-center gap-2">
                <Icon icon="refresh" className="animate-spin" />
                Loading...
              </span>
            ) : (
              'Load Models'
            )}
          </Button>
        </div>
        <div className="form-control form-control--outlined mt-2">
          <label htmlFor={apiKeyId}>API Token</label>
          <div className="flex items-center gap-2">
            <Input
              id={apiKeyId}
              type={showApiKey ? 'text' : 'password'}
              placeholder="Optional bearer token"
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setAvailableModels([]);
              }}
            />
            <Button
              className="border-md rounded-md border border-solid border-(--hl-md) px-3 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
              onPress={() => setShowApiKey(prev => !prev)}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        {(selectedModel || isCurrentBackend) && (
          <div className="mt-4">
            <Button
              className="flex w-full items-center justify-between rounded-md border border-(--hl-md) bg-(--color-bg) px-4 py-3 text-left text-(--color-font) transition-all hover:bg-(--hl-xs)"
              onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <Text className="font-medium">Advanced Options</Text>
              <Icon icon={showAdvancedOptions ? 'chevron-up' : 'chevron-down'} />
            </Button>

            {showAdvancedOptions && (
              <div className="mt-3 rounded-md border border-(--hl-md) bg-(--hl-xs) p-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control form-control--outlined">
                    <label htmlFor={temperatureId}>Temperature (0-2):</label>
                    <Input
                      id={temperatureId}
                      type="number"
                      value={modelParameters.temperature.toString()}
                      onChange={e => {
                        const value = Number.parseFloat(e.target.value);
                        if (!Number.isNaN(value) && value >= 0 && value <= 2) {
                          setModelParameters(prev => ({ ...prev, temperature: value }));
                        }
                      }}
                      step="0.1"
                      min={0}
                      max={2}
                    />
                  </div>

                  <div className="form-control form-control--outlined">
                    <label htmlFor={topPId}>Top P (0-1):</label>
                    <Input
                      id={topPId}
                      type="number"
                      value={modelParameters.topP.toString()}
                      onChange={e => {
                        const value = Number.parseFloat(e.target.value);
                        if (!Number.isNaN(value) && value >= 0 && value <= 1) {
                          setModelParameters(prev => ({ ...prev, topP: value }));
                        }
                      }}
                      step="0.01"
                      min={0}
                      max={1}
                    />
                  </div>

                  <div className="form-control form-control--outlined">
                    <label htmlFor={maxTokensId}>Max Tokens (1-128000):</label>
                    <Input
                      id={maxTokensId}
                      type="number"
                      value={modelParameters.maxTokens.toString()}
                      onChange={e => {
                        const value = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(value) && value >= 1 && value <= 128_000) {
                          setModelParameters(prev => ({ ...prev, maxTokens: value }));
                        }
                      }}
                      step="1"
                      min="1"
                      max="128000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-500" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        {showActiveModel && (
          <div className="mt-2 flex items-center gap-2">
            <Text className="flex items-center py-1 text-sm">
              <span className="font-semibold">Active model:&nbsp;</span>
              {currentLLM.model}
            </Text>
            <Button
              className="border-md m-0 rounded-md border border-solid border-(--hl-md) px-3 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
              isDisabled={isLoadingModels}
              onPress={() => fetchAvailableModels()}
            >
              {isLoadingModels ? (
                <span className="flex items-center gap-2">
                  <Icon icon="refresh" className="animate-spin" />
                  Loading...
                </span>
              ) : (
                'Change'
              )}
            </Button>
          </div>
        )}
        {showModelSelector && (
          <div className="form-control form-control--outlined mt-2">
            <label htmlFor={modelsId}>Model</label>
            <select id={modelsId} value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
              <option value="">Select a model</option>
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-2 flex flex-row justify-between gap-2">
          {showActionButtons && (
            <>
              <Button
                isDisabled={activateDisabled}
                onPress={handleActivate}
                className={`border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset ${activateDisabled ? 'opacity-50' : ''}`}
              >
                Activate
              </Button>
              {isCurrentBackend && (
                <Button
                  onPress={deactivateCurrentLLM}
                  className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                >
                  Deactivate
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
