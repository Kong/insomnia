import { useCallback, useEffect, useState } from 'react';
import { Button, Switch } from 'react-aria-components';

import type { AIFeatureNames, LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Badge } from '~/ui/components/base/badge';
import { Claude } from '~/ui/components/settings/llms/claude';
import { Gemini } from '~/ui/components/settings/llms/gemini';
import { GGUF } from '~/ui/components/settings/llms/gguf';
import { OpenAI } from '~/ui/components/settings/llms/openai';
import { Url } from '~/ui/components/settings/llms/url';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';

export const AISettings = () => {
  const { features } = useOrganizationPermissions();
  const [currentLLM, setCurrentLLM] = useState<LLMConfig | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<LLMBackend>('gguf');
  const [configuredLLMs, setConfiguredLLMs] = useState<LLMConfig[]>([]);
  const [aiFeatures, setAIFeatures] = useState<Record<AIFeatureNames, boolean>>({
    aiMockServers: false,
    aiCommitMessages: false,
    aiMcpClient: false,
  });

  const hasActiveLLM = currentLLM !== null;
  // If the feature is undefined, default to disabled (org hasn't enabled it)
  const isMockServerEnabledByOrg = features.aiMockServers ? features.aiMockServers.enabled : false;
  const isCommitMessagesEnabledByOrg = features.aiCommitMessages ? features.aiCommitMessages.enabled : false;
  const isMcpClientEnabledByOrg = features.aiMcpClient ? features.aiMcpClient.enabled : false;
  const isMockServerFeatureDisabled = !(hasActiveLLM && isMockServerEnabledByOrg);
  const isCommitMessagesFeatureDisabled = !(hasActiveLLM && isCommitMessagesEnabledByOrg);
  const isMcpClientFeatureDisabled = !(hasActiveLLM && isMcpClientEnabledByOrg);

  useEffect(() => {
    const loadConfigurations = async () => {
      const configs = await window.main.llm.getAllConfigurations();
      const current = await window.main.llm.getActiveBackend();
      const mockServerFeature = await window.main.llm.getAIFeatureEnabled('aiMockServers');
      const commitMessagesFeature = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');
      const mcpClientFeature = await window.main.llm.getAIFeatureEnabled('aiMcpClient');

      setAIFeatures({
        aiMockServers: isMockServerEnabledByOrg && mockServerFeature,
        aiCommitMessages: isCommitMessagesEnabledByOrg && commitMessagesFeature,
        aiMcpClient: isMcpClientEnabledByOrg && mcpClientFeature,
      });

      setConfiguredLLMs(configs);
      if (current) {
        setCurrentLLM(configs.find(llm => llm.backend === current) || null);
        setSelectedBackend(current);
      }
    };

    loadConfigurations();
  }, [isMockServerEnabledByOrg, isCommitMessagesEnabledByOrg, isMcpClientEnabledByOrg]);

  const toggleAIFeature = useCallback(async (feature: AIFeatureNames, enabled: boolean) => {
    setAIFeatures(prev => ({ ...prev, [feature]: enabled }));
    await window.main.llm.setAIFeatureEnabled(feature, enabled);
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
    await toggleAIFeature('aiMockServers', false);
    await toggleAIFeature('aiCommitMessages', false);
    await toggleAIFeature('aiMcpClient', false);
  }, [toggleAIFeature]);

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
            <h3 className="mb-2 text-lg font-semibold text-(--color-font)">
              <Badge color="surprise" icon="sparkles" label="AI" />
              Features
            </h3>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">Auto-generated Mock Servers</span>
              <p className="text-xs text-(--hl)">
                Create mock servers from your API definition or with natural language
              </p>
            </div>
            <span className="group relative inline-flex h-6 w-11">
              <Switch
                isSelected={aiFeatures.aiMockServers && isMockServerEnabledByOrg}
                onChange={(enabled) => toggleAIFeature('aiMockServers', enabled)}
                isDisabled={isMockServerFeatureDisabled}
                className="group flex items-center gap-2"
              >
                <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50 group-data-selected:bg-(--color-surprise)">
                  <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
                </div>
              </Switch>
              {isMockServerFeatureDisabled && (
                <div className="pointer-events-none absolute top-full right-0 z-50 mt-1 hidden max-w-[1200px] min-w-[220px] rounded border border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-center text-sm wrap-break-word whitespace-normal text-(--color-font) group-hover:block">
                  {!isMockServerEnabledByOrg
                    ? 'Your organization admin has disabled the use of AI features'
                    : 'Configure and activate an LLM to enable this feature'}
                </div>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">Smart Commits</span>
              <p className="text-xs text-(--hl)">Suggest comments and grouping for Git Sync project commits</p>
            </div>
            <span className="group relative inline-flex h-6 w-11">
              <Switch
                isSelected={aiFeatures.aiCommitMessages && isCommitMessagesEnabledByOrg}
                onChange={(enabled) => toggleAIFeature('aiCommitMessages', enabled)}
                isDisabled={isCommitMessagesFeatureDisabled}
                className="group flex items-center gap-2"
              >
                <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50 group-data-selected:bg-(--color-surprise)">
                  <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
                </div>
              </Switch>
              {isCommitMessagesFeatureDisabled && (
                <div className="pointer-events-none absolute top-full right-0 z-50 mt-1 hidden max-w-[1200px] min-w-[220px] rounded border border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-center text-sm wrap-break-word whitespace-normal text-(--color-font) group-hover:block">
                  {!isCommitMessagesEnabledByOrg
                    ? 'Your organization admin has disabled the use of AI features'
                    : 'Configure and activate an LLM to enable this feature'}
                </div>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">Response sampling for MCP clients</span>
              <p className="text-xs text-(--hl)">Use an LLM to generate sample data when working with an MCP server</p>
            </div>
            <span className="group relative inline-flex h-6 w-11">
              <Switch
                isSelected={aiFeatures.aiMcpClient && isMcpClientEnabledByOrg}
                onChange={(enabled) => toggleAIFeature('aiMcpClient', enabled)}
                isDisabled={isMcpClientFeatureDisabled}
                className="group flex items-center gap-2"
              >
                <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50 group-data-selected:bg-(--color-surprise)">
                  <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
                </div>
              </Switch>
              {isMcpClientFeatureDisabled && (
                <div className="pointer-events-none absolute top-full right-0 z-50 mt-1 hidden max-w-[1200px] min-w-[220px] rounded border border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-center text-sm wrap-break-word whitespace-normal text-(--color-font) group-hover:block">
                  {!isMcpClientEnabledByOrg
                    ? 'Your organization admin has disabled the use of AI features'
                    : 'Configure and activate an LLM to enable this feature'}
                </div>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-4">
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-(--color-font)">Activate an LLM</h3>
          <p className="text-sm text-(--hl)">The LLM set to active will be used with Insomnia AI features</p>
        </div>
        <div className="flex flex-row gap-8">
          <div className="flex flex-col gap-2">
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
            <Button className={getNavStyle('url')} onClick={() => setSelectedBackend('url')}>
              <span className="flex items-center gap-2">
                LLM URL
                {currentLLM?.backend === 'url' && activeBadge}
              </span>
            </Button>
            <Button className={getNavStyle('gguf')} onClick={() => setSelectedBackend('gguf')}>
              <span className="flex items-center gap-2">
                Local LLM
                {currentLLM?.backend === 'gguf' && activeBadge}
              </span>
            </Button>
          </div>
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
          {selectedBackend === 'url' && (
            <Url
              currentLLM={currentLLM}
              saveLLMSettings={saveLLMSettings}
              deactivateCurrentLLM={deactivateCurrentLLM}
              configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'url')}
            />
          )}
          {selectedBackend === 'gguf' && (
            <GGUF
              currentLLM={currentLLM}
              saveLLMSettings={saveLLMSettings}
              deactivateCurrentLLM={deactivateCurrentLLM}
              configuredLLMs={configuredLLMs.filter(llm => llm.backend === 'gguf')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
