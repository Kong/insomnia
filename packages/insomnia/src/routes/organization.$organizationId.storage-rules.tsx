import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import type { StorageRules } from '~/models/organization';
import { fetchAndCacheOrganizationStorageRule } from '~/ui/organization-utils';

import type { Route } from './+types/organization.$organizationId.storage-rules';

export interface OrganizationStorageLoaderData {
  storagePromise: Promise<StorageRules>;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId } = params as { organizationId: string };
  return {
    storagePromise: fetchAndCacheOrganizationStorageRule(organizationId),
  };
}

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId } = params;
  await fetchAndCacheOrganizationStorageRule(organizationId, true);
  return null;
}

export function useStorageRulesLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(
    ({ organizationId }: { organizationId: string }) => {
      return fetcherLoad(
        href('/organization/:organizationId/storage-rules', {
          organizationId,
        }),
      );
    },
    [fetcherLoad],
  );

  return {
    ...fetcherRest,
    load,
  };
}

export function useStorageRulesActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ organizationId }: { organizationId: string }) => {
      return fetcherSubmit(
        {},
        {
          method: 'POST',
          action: href('/organization/:organizationId/storage-rules', {
            organizationId,
          }),
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
