import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import {
  fallbackBilling,
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';

import { isScratchpadOrganizationId } from '../../models/organization';
import { useLoaderDeferData } from './use-loader-defer-data';

export function useOrganizationPermissions() {
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  // Fetch organization permissions and features using the organization ID as the key.
  // This will ensure that the data is cached and shared across components in the same page.
  const permissionsFetcher = useOrganizationPermissionsLoaderFetcher({ key: `permissions:${organizationId}` });

  // Load organization permissions and features if they are not already loaded.
  useEffect(() => {
    const isIdleAndUninitialized = permissionsFetcher.state === 'idle' && !permissionsFetcher.data;
    if (organizationId && !isScratchpadOrganizationId(organizationId) && isIdleAndUninitialized) {
      permissionsFetcher.load({
        organizationId,
      });
    }
  }, [organizationId, permissionsFetcher]);

  const { featuresPromise, billingPromise } = permissionsFetcher.data || {};
  // Features and billing return a promise using react-router's defer() so we need to wait for the data to be available.
  const [features = fallbackFeatures] = useLoaderDeferData(featuresPromise, organizationId);

  const [billing = fallbackBilling] = useLoaderDeferData(billingPromise, organizationId);

  return { features, billing };
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
}

export function useAIFeatureStatus(): AIFeatureStatus {
  const { features } = useOrganizationPermissions();
  const [generateMockServersWithAIEnabledByUser, setGenerateMockServersWithAIEnabledByUser] = useState(false);
  const [generateCommitMessagesWithAIEnabledByUser, setGenerateCommitMessagesWithAIEnabledByUser] = useState(false);
  const [hasActiveLLM, setHasActiveLLM] = useState(false);

  const loadFeatureStatus = useCallback(async () => {
    const userEnabledGenerateMockServersWithAI = await window.main.llm.getAIFeatureEnabled('aiMockServers');
    const userEnabledGenerateCommitMessagesWithAI = await window.main.llm.getAIFeatureEnabled('aiCommitMessages');
    const currentLLM = await window.main.llm.getCurrentConfig();

    setGenerateMockServersWithAIEnabledByUser(userEnabledGenerateMockServersWithAI);
    setGenerateCommitMessagesWithAIEnabledByUser(userEnabledGenerateCommitMessagesWithAI);
    setHasActiveLLM(currentLLM !== null);
  }, []);

  useEffect(() => {
    loadFeatureStatus();
  }, [loadFeatureStatus]);

  const generateMockServersWithAIAllowedByOrg = features.aiMockServers ? features.aiMockServers.enabled : true;
  const generateCommitMessagesWithAIAllowedByOrg = features.aiCommitMessages ? features.aiCommitMessages.enabled : true;

  return {
    isGenerateMockServersWithAIEnabled:
      generateMockServersWithAIAllowedByOrg && generateMockServersWithAIEnabledByUser && hasActiveLLM,
    isGenerateCommitMessagesWithAIEnabled:
      generateCommitMessagesWithAIAllowedByOrg && generateCommitMessagesWithAIEnabledByUser && hasActiveLLM,
  };
}
