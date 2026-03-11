import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Input, Text } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Icon } from '~/ui/components/icon';

interface OpenAIModelData {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export const OpenAI = ({
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
  const apiKeyId = useId();
  const [apiKey, setApiKey] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<OpenAIModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchOpenAIAvailableModels = useCallback(
    async (apiKeyOverride?: string) => {
      const realApiKey = apiKeyOverride || apiKey;
      try {
        setIsLoadingModels(true);
        setError(null);
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${realApiKey}`,
          },
        });
        if (!response.ok) {
          // 400, 401, 403 typically indicate invalid credentials
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            setError('The API token you have entered is invalid.');
          } else {
            setError('Failed to load models. Please try again.');
          }
          return;
        }
        const data = await response.json();

        if (data?.data?.length) {
          const gptModels = (data.data as OpenAIModelData[])
            .filter(model => model.id.includes('gpt') && model.object === 'model')
            .sort((a, b) => b.id.localeCompare(a.id));
          if (gptModels.length === 0) {
            console.error('No compatible GPT models found in OpenAI response:', data.data);
            setError('No compatible models found for this API key.');
          } else {
            setAvailableModels(gptModels);
            if (configuredLLMs.length === 1 && configuredLLMs[0].apiKey !== realApiKey) {
              saveLLMSettings(false, 'openai', { apiKey: realApiKey });
            }
          }
        } else {
          console.error('OpenAI models response contained no data:', data);
          setError('No models returned by the API.');
        }
      } catch (error) {
        console.error('Error fetching OpenAI models:', error);
        setError('Network error. Please check your connection and try again.');
      } finally {
        setIsLoadingModels(false);
      }
    },
    [saveLLMSettings, apiKey, configuredLLMs],
  );

  useEffect(() => {
    if (configuredLLMs.length === 1) {
      setSelectedModel(configuredLLMs[0].model);
      const key = configuredLLMs[0].apiKey || '';
      setApiKey(key);
    }
  }, [configuredLLMs]);

  const hasChanges = useMemo(() => {
    return selectedModel !== currentLLM?.model || apiKey !== currentLLM?.apiKey;
  }, [selectedModel, currentLLM, apiKey]);

  const modelsId = useId();

  // Extracted conditions for clearer rendering logic
  const isCurrentBackend = currentLLM?.backend === 'openai';
  const hasLoadedModels = availableModels.length > 0;
  const showActiveModel = isCurrentBackend && !hasLoadedModels;
  const showModelSelector = hasLoadedModels;
  const showActionButtons = hasLoadedModels || isCurrentBackend;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="form-control form-control--outlined">
        <label htmlFor={apiKeyId}>API Token</label>
        <p className="text-xs text-(--hl)">
          You can retrieve a token from OpenAI{' '}
          <a href="https://platform.openai.com/docs/quickstart" className="underline">
            here
          </a>
          .
        </p>
        <div className="flex flex-row gap-2">
          <Input
            id={apiKeyId}
            type="password"
            placeholder="sk-abc1234567890defABC1234567890ghijklmnopqrs"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <Button
            className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
            isDisabled={isLoadingModels || !apiKey}
            onPress={() => fetchOpenAIAvailableModels()}
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
              onPress={() => fetchOpenAIAvailableModels(currentLLM.apiKey)}
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
                isDisabled={!hasLoadedModels || !selectedModel || (isCurrentBackend && !hasChanges)}
                onPress={() => saveLLMSettings(true, 'openai', { model: selectedModel, apiKey })}
                className={`border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset ${!hasLoadedModels || (isCurrentBackend && !hasChanges) ? 'opacity-50' : ''}`}
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
