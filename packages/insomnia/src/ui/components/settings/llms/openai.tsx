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

  const fetchOpenAIAvailableModels = useCallback(
    async (apiKeyOverride?: string) => {
      const realApiKey = apiKeyOverride || apiKey;
      setIsLoadingModels(true);
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${realApiKey}`,
          },
        });
        if (!response.ok) {
          setIsLoadingModels(false);
          return;
        }
        const data = await response.json();

        if (data?.data?.length) {
          const gptModels = (data.data as OpenAIModelData[])
            .filter(model => model.id.includes('gpt') && model.object === 'model')
            .sort((a, b) => b.id.localeCompare(a.id));
          setAvailableModels(gptModels);
          if (configuredLLMs.length === 1 && configuredLLMs[0].apiKey !== realApiKey) {
            saveLLMSettings(false, 'openai', { apiKey: realApiKey });
          }
        }
      } catch (error) {
        console.error('Error fetching OpenAI models:', error);
      }
      setIsLoadingModels(false);
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
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="form-control form-control--outlined">
        <label htmlFor={apiKeyId}>API Key:</label>
        <div className="flex flex-row gap-2">
          <Input id={apiKeyId} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <Button
            className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
            isDisabled={isLoadingModels}
            onPress={() => {
              fetchOpenAIAvailableModels();
            }}
          >
            Load Models
          </Button>
        </div>
      </div>
      {isLoadingModels && (
        <div className="flex flex-row justify-between gap-2">
          <div className="flex flex-row gap-2">
            <Icon icon="refresh" className="animate-spin" />
            <Text>Loading models...</Text>
          </div>
        </div>
      )}
      {availableModels.length > 0 && (
        <div className="form-control form-control--outlined">
          <label htmlFor={modelsId}>Model:</label>
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
      <div className="flex flex-row justify-between gap-2">
        <Button
          isDisabled={currentLLM?.backend !== 'openai'}
          onClick={deactivateCurrentLLM}
          className="rounded-md border border-solid border-red-500 bg-(--color-bg) px-4 py-2 text-base text-red-500 ring-1 ring-transparent transition-all hover:border-red-600 hover:bg-(--hl-xs) focus:ring-inset focus:ring-red-300"
        >
          Deactivate
        </Button>
        <Button
          isDisabled={!hasChanges || isLoadingModels || (!!apiKey && !selectedModel)}
          onClick={() => {
            saveLLMSettings(true, 'openai', { model: selectedModel, apiKey });
          }}
          className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
        >
          Activate
        </Button>
      </div>
    </div>
  );
};
