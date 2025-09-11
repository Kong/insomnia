import { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';

import * as models from '~/models/index';
import type { LLMConfiguration } from '~/models/llm-configuration';
import { Claude } from '~/ui/components/settings/llms/claude';
import { GGUF } from '~/ui/components/settings/llms/gguf';
import { OpenAI } from '~/ui/components/settings/llms/openai';

export const LLMs = () => {
  const [currentLLM, setCurrentLLM] = useState<LLMConfiguration | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<'gguf' | 'claude' | 'openai'>();
  const [configuredLLMs, setConfiguredLLMs] = useState<LLMConfiguration[]>([]);

  useEffect(() => {
    models.llmConfiguration.all().then(configs => {
      const current = configs.find(config => config.current === 'yes');
      if (current) {
        setSelectedBackend(current.backend);
        setCurrentLLM(current);
      }
      setConfiguredLLMs(configs);
    });
  }, []);

  const saveLLMSettings = useCallback(
    async (setCurrent: boolean, backend: 'gguf' | 'claude' | 'openai', extras: Partial<LLMConfiguration> = {}) => {
      const existingConfiguration = configuredLLMs.find(config => config.backend === backend);
      let llmConfiguration: LLMConfiguration;
      if (existingConfiguration) {
        llmConfiguration = await models.llmConfiguration.update(existingConfiguration, {
          backend,
          ...extras,
        });
      } else {
        llmConfiguration = await models.llmConfiguration.create({
          backend,
          ...extras,
        });
      }
      if (setCurrent) {
        models.llmConfiguration.setCurrent(llmConfiguration);
        setCurrentLLM(llmConfiguration);
      }
      setConfiguredLLMs(configuredLLMs.map(config => (config.backend === backend ? llmConfiguration : config)));
    },
    [configuredLLMs],
  );

  const activeBadge = (
    <span className="bg-surprise flex h-5 min-w-5 items-center justify-center rounded-full px-2 py-1 text-xs text-white">
      Active
    </span>
  );

  const getNavStyle = (backend: 'gguf' | 'claude' | 'openai') => {
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
            setCurrentLLM={setCurrentLLM}
            saveLLMSettings={saveLLMSettings}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'gguf')}
          />
        )}
        {selectedBackend === 'claude' && (
          <Claude
            currentLLM={currentLLM}
            setCurrentLLM={setCurrentLLM}
            saveLLMSettings={saveLLMSettings}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'claude')}
          />
        )}
        {selectedBackend === 'openai' && (
          <OpenAI
            currentLLM={currentLLM}
            setCurrentLLM={setCurrentLLM}
            saveLLMSettings={saveLLMSettings}
            configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'openai')}
          />
        )}
      </div>
    </div>
  );
};
