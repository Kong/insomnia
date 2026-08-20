import { getOrganizationStorageRule, type StorageRules } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { useCallback } from 'react';
import { useParams } from 'react-router';

import { DEFAULT_STORAGE_RULES } from '~/common/organization-storage-rules';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import { useServerQuery } from '~/ui/hooks/use-query';

const organizationStorageRuleKey = (organizationId: string) => ['organization-storage-rule', organizationId] as const;

/**
 * @param organizationIdParam optional explicit organization ID; defaults to the
 * `organizationId` route param.
 */
export function useOrganizationStorageRule(organizationIdParam?: string): StorageRules {
  const params = useParams() as { organizationId?: string };
  const organizationId = organizationIdParam ?? params.organizationId ?? '';

  const isEnabled = !!organizationId && !models.organization.isScratchpadOrganizationId(organizationId);

  const { data } = useServerQuery({
    queryKey: organizationStorageRuleKey(organizationId),
    queryFn: async () => {
      const { id: sessionId } = await services.userSession.get();
      return getOrganizationStorageRule({ organizationId, sessionId });
    },
    enabled: isEnabled,
  });

  // Fall back to safe defaults while loading, when disabled (scratchpad), or on error.
  return data ?? DEFAULT_STORAGE_RULES;
}

export function useInvalidateOrganizationStorageRule() {
  const queryClient = useServerDataQueryClient();
  return useCallback(
    (organizationId: string) => queryClient.invalidateQueries({ queryKey: organizationStorageRuleKey(organizationId) }),
    [queryClient],
  );
}
