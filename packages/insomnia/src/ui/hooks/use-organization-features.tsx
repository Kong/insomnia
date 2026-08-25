import { type Billing, type FeatureList, getOrganizationFeatures } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { useServerQuery } from '~/ui/hooks/use-query';

export const fallbackFeatures = Object.freeze<FeatureList>({
  bulkImport: { enabled: false, reason: 'Insomnia API unreachable' },
  gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
  orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  aiMockServers: { enabled: false, reason: 'Insomnia API unreachable' },
  aiCommitMessages: { enabled: false, reason: 'Insomnia API unreachable' },
  aiMcpClient: { enabled: false, reason: 'Insomnia API unreachable' },
  konnectSync: { enabled: false, reason: 'Insomnia API unreachable' },
});

// If network unreachable assume user has paid for the current period
export const fallbackBilling = Object.freeze<Billing>({
  isActive: true,
  expirationWarningMessage: '',
  expirationErrorMessage: '',
  accessDenied: false,
});

/**
 * Fetches the organization's features and billing from the Insomnia API using
 * TanStack Query. Keying on the organization ID means all consumers share a
 * single resolved copy from the server-data cache, so the value can no longer
 * desync between components (the root cause of the missing Konnect tab).
 *
 * @param organizationIdParam optional explicit organization ID; defaults to the
 * `organizationId` route param.
 */
export function useOrganizationPermissions(organizationIdParam?: string) {
  const params = useParams() as { organizationId?: string };
  const organizationId = organizationIdParam ?? params.organizationId ?? '';

  const isEnabled = !!organizationId && !models.organization.isScratchpadOrganizationId(organizationId);

  const { data } = useServerQuery({
    queryKey: ['organization-features', organizationId],
    queryFn: async () => {
      const { id: sessionId } = await services.userSession.get();
      return getOrganizationFeatures({ organizationId, sessionId });
    },
    enabled: isEnabled,
  });

  // Fall back to safe defaults while loading, when disabled (scratchpad), or on error.
  return {
    features: data?.features ?? fallbackFeatures,
    billing: data?.billing ?? fallbackBilling,
  };
}

/**
 * Hook to check if AI features are fully enabled at both organization and user level
 * A feature is considered fully enabled only if:
 * 1. Organization has enabled the feature
 * 2. User has enabled the feature in their settings
 * 3. User has an active LLM configured
 */
interface AIFeatureStatus {
  isGenerateMockServersWithAIEnabled: boolean;
  isGenerateCommitMessagesWithAIEnabled: boolean;
  isMCPWithAIEnabled: boolean;
}

export function useAIFeatureStatus(): AIFeatureStatus {
  const { features } = useOrganizationPermissions();
  const [generateMockServersWithAIEnabledByUser, setGenerateMockServersWithAIEnabledByUser] = useState(false);
  const [generateCommitMessagesWithAIEnabledByUser, setGenerateCommitMessagesWithAIEnabledByUser] = useState(false);
  const [mcpIntegrationWithAIEnabledByUser, setMCPIntegrationWithAIEnabledByUser] = useState(false);
  const [hasActiveLLM, setHasActiveLLM] = useState(false);

  const loadFeatureStatus = useCallback(async () => {
    const userEnabledGenerateMockServersWithAI = await window.main.llm.getAIFeatureEnabled('aiMockServers');
    const userEnabledGenerateCommitMessagesWithAI = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');
    const userEnabledMcpClientWithAI = await window.main.llm.getAIFeatureEnabled('aiMcpClient');

    const currentLLM = await window.main.llm.getCurrentConfig();

    setGenerateMockServersWithAIEnabledByUser(userEnabledGenerateMockServersWithAI);
    setGenerateCommitMessagesWithAIEnabledByUser(userEnabledGenerateCommitMessagesWithAI);
    setMCPIntegrationWithAIEnabledByUser(userEnabledMcpClientWithAI);
    setHasActiveLLM(currentLLM !== null);
  }, []);

  useEffect(() => {
    loadFeatureStatus();
  }, [loadFeatureStatus]);

  // Re-read the status when the AI settings change in the main process (the
  // source of truth), since this hook would otherwise keep a stale snapshot
  // taken at mount time. Main broadcasts to every window, so all consumers stay
  // consistent regardless of which window performed the change.
  useEffect(() => {
    const unsubscribe = window.main.on('llm.changed', loadFeatureStatus);
    return unsubscribe;
  }, [loadFeatureStatus]);

  const generateMockServersWithAIAllowedByOrg = features.aiMockServers ? features.aiMockServers.enabled : true;
  const generateCommitMessagesWithAIAllowedByOrg = features.aiCommitMessages ? features.aiCommitMessages.enabled : true;
  const mcpClientWithAIAllowedByOrg = features.aiMcpClient ? features.aiMcpClient.enabled : true;

  return {
    isGenerateMockServersWithAIEnabled:
      generateMockServersWithAIAllowedByOrg && generateMockServersWithAIEnabledByUser && hasActiveLLM,
    isGenerateCommitMessagesWithAIEnabled:
      generateCommitMessagesWithAIAllowedByOrg && generateCommitMessagesWithAIEnabledByUser && hasActiveLLM,
    isMCPWithAIEnabled: mcpClientWithAIAllowedByOrg && mcpIntegrationWithAIEnabledByUser && hasActiveLLM,
  };
}

export function useIsGitSyncEnabled(organizationId: string) {
  const { features } = useOrganizationPermissions(organizationId);
  return features.gitSync.enabled;
}
