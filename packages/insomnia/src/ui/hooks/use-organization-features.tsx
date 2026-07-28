import { models } from 'insomnia-data';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';

import {
  fallbackBilling,
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';

// ---------------------------------------------------------------------------
// Shared, per-organization resolution store.
//
// The permissions loader returns deferred promises (`featuresPromise`,
// `billingPromise`) shared across every consumer via the react-router fetcher
// key. Previously each consumer unwrapped that promise into its own local
// `useState` (via `useLoaderDeferData`), so the copies could desync: one
// component's copy would resolve to the real value while another stayed on the
// fallback. This store resolves each promise ONCE per organization and shares
// the resolved value with all consumers through `useSyncExternalStore`, so they
// always agree.
// ---------------------------------------------------------------------------
const createSharedDeferredStore = () => {
  const values = new Map<string, unknown>();
  const latest = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<() => void>>();
  const ingested = new WeakSet<Promise<unknown>>();

  const notify = (key: string) => {
    listeners.get(key)?.forEach(cb => cb());
  };

  return {
    subscribe(key: string, cb: () => void) {
      const set = listeners.get(key) ?? new Set<() => void>();
      listeners.set(key, set);
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    getSnapshot(key: string) {
      return values.get(key);
    },
    ingest(key: string, promise?: Promise<unknown>) {
      if (!promise) {
        return;
      }
      // Track the most recent promise for this key so an out-of-order older
      // resolution can't overwrite a newer value.
      latest.set(key, promise);
      if (ingested.has(promise)) {
        return;
      }
      ingested.add(promise);
      promise.then(
        value => {
          if (latest.get(key) === promise) {
            values.set(key, value);
            notify(key);
          }
        },
        err => {
          // Consumers fall back to their default value, but keep the failure
          // observable. This runs once per promise (deduped above), so it does
          // not produce the previous per-consumer warning spam.
          console.warn('Failed to load deferred permissions data', err);
        },
      );
    },
  };
};

const permissionsStore = createSharedDeferredStore();

/**
 * Resolve a deferred promise through the shared store and return the resolved
 * value (or `undefined` until it resolves). All consumers passing the same
 * `key` read the same value and stay in sync.
 */
function useSharedDeferredData<T>(key: string, promise?: Promise<T>): T | undefined {
  // Kick off resolution once per promise. Done in an effect to keep render pure;
  // the store dedupes by promise identity so concurrent consumers are cheap.
  useEffect(() => {
    permissionsStore.ingest(key, promise);
  }, [key, promise]);

  const getSnapshot = () => permissionsStore.getSnapshot(key) as T | undefined;
  return useSyncExternalStore(
    useCallback(cb => permissionsStore.subscribe(key, cb), [key]),
    getSnapshot,
    getSnapshot,
  );
}

export function useOrganizationPermissions() {
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  // Fetch organization permissions and features using the organization ID as the key.
  // This will ensure that the data is cached and shared across components in the same page.
  const permissionsFetcher = useOrganizationPermissionsLoaderFetcher({ key: `permissions:${organizationId}` });

  // Load organization permissions and features if they are not already loaded.
  // Depend only on the stable `load` callback and the primitive state/data
  // flags (not the whole fetcher object, which is re-created every render) so
  // the loader is triggered once instead of on every render.
  const { load, state, data } = permissionsFetcher;
  useEffect(() => {
    if (organizationId && !models.organization.isScratchpadOrganizationId(organizationId) && state === 'idle' && !data) {
      load({
        organizationId,
      });
    }
  }, [organizationId, load, state, data]);

  const { featuresPromise, billingPromise } = permissionsFetcher.data || {};
  // Features and billing return a promise using react-router's defer(); resolve
  // them through the shared store so every consumer sees the same value.
  const features = useSharedDeferredData(`${organizationId}:features`, featuresPromise) ?? fallbackFeatures;
  const billing = useSharedDeferredData(`${organizationId}:billing`, billingPromise) ?? fallbackBilling;

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
  const permissionsFetcher = useOrganizationPermissionsLoaderFetcher({ key: `permissions:${organizationId}` });
  const { load, state, data } = permissionsFetcher;
  useEffect(() => {
    if (state === 'idle' && !data) {
      load({
        organizationId,
      });
    }
  }, [organizationId, load, state, data]);
  const { featuresPromise } = permissionsFetcher.data || {};
  const features = useSharedDeferredData(`${organizationId}:features`, featuresPromise) ?? fallbackFeatures;
  return features.gitSync.enabled;
}
