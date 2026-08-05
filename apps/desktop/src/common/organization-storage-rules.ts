import { getOrganizationStorageRule, type StorageRules } from 'insomnia-api';
import { models, services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';

const inMemoryStorageRuleCache: Map<string, StorageRules> = new Map<string, StorageRules>();

export const DEFAULT_STORAGE_RULES = {
  enableCloudSync: true,
  enableLocalVault: true,
  enableGitSync: true,
  isOverridden: false,
};

export async function fetchAndCacheOrganizationStorageRule(
  organizationId: string | undefined,
  forceFetch = false,
): Promise<StorageRules> {
  invariant(organizationId, 'Organization ID is required');

  if (models.organization.isScratchpadOrganizationId(organizationId)) {
    return {
      enableCloudSync: false,
      enableLocalVault: true,
      enableGitSync: false,
      isOverridden: false,
    };
  }

  if (!forceFetch) {
    const storageRules = inMemoryStorageRuleCache.get(organizationId);
    if (storageRules) {
      return storageRules;
    }
  }

  const { id: sessionId } = await services.userSession.get();

  return await getOrganizationStorageRule({
    organizationId,
    sessionId,
  }).then(
    res => {
      if (res) {
        inMemoryStorageRuleCache.set(organizationId, res);
      }
      return res || DEFAULT_STORAGE_RULES;
    },
    err => {
      console.log('[storageRule] Failed to load storage rules', err.message);
      return DEFAULT_STORAGE_RULES;
    },
  );
}
