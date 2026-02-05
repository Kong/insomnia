import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Input, Text } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Icon } from '~/ui/components/icon';

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
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<LLMModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchAvailableModels = useCallback(
    async (urlOverride?: string) => {
      const realUrl = urlOverride || url;
      if (!validateUrl(realUrl)) {
        setError('Please enter a valid HTTP or HTTPS URL.');
        return;
      }

      try {
        setIsLoadingModels(true);
        setError(null);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        const modelsUrl = new URL('models', realUrl.endsWith('/') ? realUrl : `${realUrl}/`);
        const response = await fetch(modelsUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
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
        setAvailableModels(models);
        saveLLMSettings(false, URL_BACKEND, { url: realUrl, model: 'default' });
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
    [saveLLMSettings, url],
  );

  useEffect(() => {
    if (configuredLLMs.length > 0) {
      if (configuredLLMs[0].url) {
        setUrl(configuredLLMs[0].url);
      }
      if (configuredLLMs[0].model) {
        setSelectedModel(configuredLLMs[0].model);
      }
    }
    // Also check currentLLM
    if (currentLLM?.backend === URL_BACKEND) {
      if (currentLLM.url) {
        setUrl(currentLLM.url);
      }
      if (currentLLM.model) {
        setSelectedModel(currentLLM.model);
      }
    }
  }, [configuredLLMs, currentLLM]);

  const hasChanges = useMemo(() => {
    return url !== currentLLM?.url || selectedModel !== currentLLM?.model;
  }, [url, selectedModel, currentLLM]);

  const modelsId = useId();

  const handleActivate = () => {
    setError(null);

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    if (!selectedModel) {
      setError('Please select a model.');
      return;
    }

    saveLLMSettings(true, URL_BACKEND, { url, model: selectedModel } as Partial<LLMConfig>);
  };

  // Extracted conditions for clearer rendering logic
  const isCurrentBackend = currentLLM?.backend === URL_BACKEND;
  const hasLoadedModels = availableModels.length > 0;
  const showActiveModel = isCurrentBackend && !hasLoadedModels;
  const showModelSelector = hasLoadedModels;
  const showActionButtons = hasLoadedModels || isCurrentBackend;

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
            onChange={e => setUrl(e.target.value)}
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
              onPress={() => fetchAvailableModels(currentLLM.url)}
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
                onPress={handleActivate}
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
