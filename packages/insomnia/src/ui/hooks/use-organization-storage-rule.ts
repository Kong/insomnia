import type { StorageRules } from 'insomnia-api';
import { useCallback } from 'react';
import { useParams } from 'react-router';

import { DEFAULT_STORAGE_RULES, fetchAndCacheOrganizationStorageRule } from '~/common/organization-storage-rules';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import { useServerQuery } from '~/ui/hooks/use-query';

const organizationStorageRuleKey = (organizationId: string) => ['organization-storage-rule', organizationId] as const;

/**
 * @param organizationIdParam optional explicit organization ID; defaults to the
 * `organizationId` route param.
 *
 * Delegates to `fetchAndCacheOrganizationStorageRule`, which already short-circuits local-only
 * organizations (Scratchpad, Konnect) with the correct hardcoded rules and no network call — do
 * not reimplement that check here as an `enabled` gate, since falling back to
 * `DEFAULT_STORAGE_RULES` on a disabled query would surface Cloud Sync / Git Sync options inside
 * those organizations (the opposite of the local-only rules).
 */
export function useOrganizationStorageRule(organizationIdParam?: string): StorageRules {
  const params = useParams() as { organizationId?: string };
  const organizationId = organizationIdParam ?? params.organizationId ?? '';

  const { data } = useServerQuery({
    queryKey: organizationStorageRuleKey(organizationId),
    queryFn: () => fetchAndCacheOrganizationStorageRule(organizationId),
    enabled: !!organizationId,
  });

  // Fall back to safe defaults while loading or on error.
  return data ?? DEFAULT_STORAGE_RULES;
}

export function useInvalidateOrganizationStorageRule() {
  const queryClient = useServerDataQueryClient();
  return useCallback(
    (organizationId: string) => queryClient.invalidateQueries({ queryKey: organizationStorageRuleKey(organizationId) }),
    [queryClient],
  );
}
