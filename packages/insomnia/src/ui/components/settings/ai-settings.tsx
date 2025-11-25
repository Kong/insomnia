import { useCallback, useEffect, useState } from 'react';
import { Button, Switch } from 'react-aria-components';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Badge } from '~/ui/components/base/badge';
import { Claude } from '~/ui/components/settings/llms/claude';
import { Gemini } from '~/ui/components/settings/llms/gemini';
import { GGUF } from '~/ui/components/settings/llms/gguf';
import { OpenAI } from '~/ui/components/settings/llms/openai';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';

export const AISettings = () => {
  const { features } = useOrganizationPermissions();
  const [currentLLM, setCurrentLLM] = useState<LLMConfig | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<LLMBackend>('gguf');
  const [configuredLLMs, setConfiguredLLMs] = useState<LLMConfig[]>([]);
  const [mockServerEnabled, setMockServerEnabled] = useState(false);
  const [commitMessagesEnabled, setCommitMessagesEnabled] = useState(false);

  const hasActiveLLM = currentLLM !== null;
  // If the feature is undefined, default to disabled (org hasn't enabled it)
  const isMockServerEnabledByOrg = features.aiMockServers ? features.aiMockServers.enabled : false;
  const isCommitMessagesEnabledByOrg = features.aiCommitMessages ? features.aiCommitMessages.enabled : false;

  useEffect(() => {
    const loadConfigurations = async () => {
      const configs = await window.main.llm.getAllConfigurations();
      const current = await window.main.llm.getActiveBackend();
      const mockServerFeature = await window.main.llm.getAIFeatureEnabled('aiMockServers');
      const commitMessagesFeature = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');

      setMockServerEnabled(isMockServerEnabledByOrg && mockServerFeature);
      setCommitMessagesEnabled(isCommitMessagesEnabledByOrg && commitMessagesFeature);

      setConfiguredLLMs(configs);
      if (current) {
        setCurrentLLM(configs.find(llm => llm.backend === current) || null);
        setSelectedBackend(current);
      }
    };

    loadConfigurations();
  }, [isMockServerEnabledByOrg, isCommitMessagesEnabledByOrg]);

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
    setMockServerEnabled(false);
    setCommitMessagesEnabled(false);
    await window.main.llm.setAIFeatureEnabled('aiMockServers', false);
    await window.main.llm.setAIFeatureEnabled('aiCommitMessages', false);
  }, []);

  const handleMockServerToggle = useCallback(async (enabled: boolean) => {
    setMockServerEnabled(enabled);
    await window.main.llm.setAIFeatureEnabled('aiMockServers', enabled);
  }, []);

  const handleCommitMessagesToggle = useCallback(async (enabled: boolean) => {
    setCommitMessagesEnabled(enabled);
    await window.main.llm.setAIFeatureEnabled('aiCommitMessages', enabled);
  }, []);

  const activeBadge = (
    <span className="bg-surprise flex h-5 min-w-5 items-center justify-center rounded-full px-2 py-1 text-xs text-white">
      Active
    </span>
  );

  const getNavStyle = (backend: LLMBackend) => {
    return `w-[140px] rounded-xs border border-solid px-4 py-2 text-base ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) ${
      selectedBackend === backend
        ? 'border-(--color-surprise) bg-(--hl-xs) text-(--color-font)'
        : 'border-(--hl-sm) text-(--color-font)'
    }`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-4">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-3 text-base font-semibold text-(--color-font)">
              <Badge color="surprise" icon="sparkles" label="AI" />
              Features
            </h3>
            {!hasActiveLLM ? (
              <p className="mb-4 text-sm text-(--hl)">Configure and activate an LLM below to enable AI features.</p>
            ) : (
              <p className="mb-4 text-sm text-(--color-font)">Enable AI-powered features in Insomnia.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">
                Auto-generate Mock Servers from natural language
              </span>
              {!isMockServerEnabledByOrg ? (
                <p className="text-xs text-(--color-danger)">
                  Disabled by organization{features.aiMockServers?.reason ? `: ${features.aiMockServers.reason}` : ''}
                </p>
              ) : !hasActiveLLM ? (
                <p className="text-xs text-(--hl)">Configure and activate an LLM to enable this feature</p>
              ) : null}
            </div>
            <Switch
              isSelected={mockServerEnabled && isMockServerEnabledByOrg}
              onChange={handleMockServerToggle}
              isDisabled={!hasActiveLLM || !isMockServerEnabledByOrg}
              className="group flex items-center gap-2"
            >
              <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled:cursor-not-allowed group-data-selected:bg-(--color-surprise) group-data-disabled:opacity-50">
                <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
              </div>
            </Switch>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">Suggest comments and grouping for Commits</span>
              {!isCommitMessagesEnabledByOrg ? (
                <p className="text-xs text-(--color-danger)">
                  Disabled by organization
                  {features.aiCommitMessages?.reason ? `: ${features.aiCommitMessages.reason}` : ''}
                </p>
              ) : !hasActiveLLM ? (
                <p className="text-xs text-(--hl)">Configure and activate an LLM to enable this feature</p>
              ) : null}
            </div>
            <Switch
              isSelected={commitMessagesEnabled && isCommitMessagesEnabledByOrg}
              onChange={handleCommitMessagesToggle}
              isDisabled={!hasActiveLLM || !isCommitMessagesEnabledByOrg}
              className="group flex items-center gap-2"
            >
              <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled:cursor-not-allowed group-data-selected:bg-(--color-surprise) group-data-disabled:opacity-50">
                <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
              </div>
            </Switch>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-4">
        <p className="notice info mb-4 text-sm">
          Activate a large language model here for use with Insomnia AI features.
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
            <Button className={getNavStyle('gemini')} onClick={() => setSelectedBackend('gemini')}>
              <span className="flex items-center gap-2">
                Gemini
                {currentLLM?.backend === 'gemini' && activeBadge}
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
          {selectedBackend === 'gemini' && (
            <Gemini
              currentLLM={currentLLM}
              saveLLMSettings={saveLLMSettings}
              deactivateCurrentLLM={deactivateCurrentLLM}
              configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'gemini')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
