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
  const [mcpClientEnabled, setMcpClientEnabled] = useState(false);

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

      setMockServerEnabled(isMockServerEnabledByOrg && mockServerFeature);
      setCommitMessagesEnabled(isCommitMessagesEnabledByOrg && commitMessagesFeature);
      setMcpClientEnabled(isMcpClientEnabledByOrg && mcpClientFeature);

      setConfiguredLLMs(configs);
      if (current) {
        setCurrentLLM(configs.find(llm => llm.backend === current) || null);
        setSelectedBackend(current);
      }
    };

    loadConfigurations();
  }, [isMockServerEnabledByOrg, isCommitMessagesEnabledByOrg, isMcpClientEnabledByOrg]);

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

  const handleMcpClientToggle = useCallback(async (enabled: boolean) => {
    setMcpClientEnabled(enabled);
    await window.main.llm.setAIFeatureEnabled('aiMcpClient', enabled);
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
                isSelected={mockServerEnabled && isMockServerEnabledByOrg}
                onChange={handleMockServerToggle}
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
                isSelected={commitMessagesEnabled && isCommitMessagesEnabledByOrg}
                onChange={handleCommitMessagesToggle}
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
                isSelected={mcpClientEnabled && isMcpClientEnabledByOrg}
                onChange={handleMcpClientToggle}
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
