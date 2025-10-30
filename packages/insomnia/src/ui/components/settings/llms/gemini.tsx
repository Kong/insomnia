import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Input, Text } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Icon } from '~/ui/components/icon';

interface GeminiModelData {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

export const Gemini = ({
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
  const [availableModels, setAvailableModels] = useState<GeminiModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const fetchGeminiAvailableModels = useCallback(
    async (apiKeyOverride?: string) => {
      const realApiKey = apiKeyOverride || apiKey;
      setIsLoadingModels(true);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${realApiKey}`);
        if (!response.ok) {
          setIsLoadingModels(false);
          return;
        }
        const data = await response.json();

        if (data?.models?.length) {
          const geminiModels = (data.models as GeminiModelData[])
            .filter(model => model.supportedGenerationMethods.includes('generateContent'))
            .sort((a, b) => b.name.localeCompare(a.name));
          setAvailableModels(geminiModels);
          if (configuredLLMs.length === 1 && configuredLLMs[0].apiKey !== realApiKey) {
            saveLLMSettings(false, 'gemini', { apiKey: realApiKey });
          }
        }
      } catch (error) {
        console.error('Error fetching Gemini models:', error);
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
            className="border-md rounded-md border border-solid border-[--hl-md] px-4 py-1 text-base text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm]"
            isDisabled={isLoadingModels}
            onPress={() => {
              fetchGeminiAvailableModels();
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
              <option key={model.name} value={model.name}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-row justify-between gap-2">
        <Button
          isDisabled={currentLLM?.backend !== 'gemini'}
          onClick={deactivateCurrentLLM}
          className="rounded-md border border-solid border-red-500 bg-[--color-bg] px-4 py-2 text-base text-red-500 ring-1 ring-transparent transition-all hover:border-red-600 hover:bg-[--hl-xs] focus:ring-inset focus:ring-red-300"
        >
          Deactivate
        </Button>
        <Button
          isDisabled={!hasChanges || isLoadingModels || (!!apiKey && !selectedModel)}
          onClick={() => {
            saveLLMSettings(true, 'gemini', { model: selectedModel, apiKey });
          }}
          className="border-md rounded-md border border-solid border-[--hl-md] px-4 py-1 text-base text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm]"
        >
          Activate
        </Button>
      </div>
    </div>
  );
};
