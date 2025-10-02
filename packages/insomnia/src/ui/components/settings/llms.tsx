import { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Claude } from '~/ui/components/settings/llms/claude';
import { GGUF } from '~/ui/components/settings/llms/gguf';
import { OpenAI } from '~/ui/components/settings/llms/openai';

export const LLMs = () => {
  const [currentLLM, setCurrentLLM] = useState<LLMConfig | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<LLMBackend>('gguf');
  const [configuredLLMs, setConfiguredLLMs] = useState<LLMConfig[]>([]);

  useEffect(() => {
    const loadConfigurations = async () => {
      const configs = await window.main.llm.getAllConfigurations();
      const current = await window.main.llm.getActiveBackend();

      setConfiguredLLMs(configs);
      if (current) {
        setCurrentLLM(configs.find(llm => llm.backend === current) || null);
        setSelectedBackend(current);
      }
    };

    loadConfigurations();
  }, []);

  const saveLLMSettings = useCallback(
    async (setCurrent: boolean, backend: LLMBackend, extras: Partial<LLMConfig> = {}) => {
      await window.main.llm.updateBackendConfig(backend, extras);

      if (setCurrent) {
        await window.main.llm.setActiveBackend(backend);
        const newCurrentConfig = await window.main.llm.getCurrentConfig();
        setCurrentLLM(newCurrentConfig);
      }

      const updatedConfigs = await window.main.llm.getAllConfigurations();
      setConfiguredLLMs(updatedConfigs);
    },
    [],
  );

  const deactivateCurrentLLM = useCallback(async () => {
    await window.main.llm.clearActiveBackend();
    setCurrentLLM(null);
  }, []);

  const activeBadge = (
    <span className="bg-surprise flex h-5 min-w-5 items-center justify-center rounded-full px-2 py-1 text-xs text-white">
      Active
    </span>
  );

  const getNavStyle = (backend: LLMBackend) => {
    return `w-[140px] rounded-sm border border-solid px-4 py-2 text-base ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] ${
      selectedBackend === backend
        ? 'border-[--color-surprise] bg-[--hl-xs] text-[--color-font]'
        : 'border-[--hl-sm] text-[--color-font]'
    }`;
  };

  return (
    <div>
      <p className="notice info text-sm">
        Activate a large language model here to enable Insomnia's generative AI features.
        <br />
        The active LLM can be used for generating commit messages, mock responses, and more.
      </p>
      <div className="flex flex-row gap-8">
        <div className="flex flex-col gap-2">
          <Button className={getNavStyle('gguf')} onClick={() => setSelectedBackend('gguf')}>
            <span className="flex items-center gap-2">
              Local LLM
              {currentLLM?.backend === 'gguf' && activeBadge}
            </span>
          </Button>
          <Button className={getNavStyle('claude')} onClick={() => setSelectedBackend('claude')}>
            <span className="flex items-center gap-2">
              Claude
              {currentLLM?.backend === 'claude' && activeBadge}
            </span>
          </Button>
          <Button className={getNavStyle('openai')} onClick={() => setSelectedBackend('openai')}>
            <span className="flex items-center gap-2">
              OpenAI
              {currentLLM?.backend === 'openai' && activeBadge}
            </span>
          </Button>
        </div>
        {selectedBackend === 'gguf' && (
          <GGUF
            currentLLM={currentLLM}
            saveLLMSettings={saveLLMSettings}
            deactivateCurrentLLM={deactivateCurrentLLM}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'gguf')}
          />
        )}
        {selectedBackend === 'claude' && (
          <Claude
            currentLLM={currentLLM}
            saveLLMSettings={saveLLMSettings}
            deactivateCurrentLLM={deactivateCurrentLLM}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'claude')}
          />
        )}
        {selectedBackend === 'openai' && (
          <OpenAI
            currentLLM={currentLLM}
            saveLLMSettings={saveLLMSettings}
            deactivateCurrentLLM={deactivateCurrentLLM}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'openai')}
          />
        )}
      </div>
    </div>
  );
};
