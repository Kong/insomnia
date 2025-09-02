import { href } from 'react-router';

import type { StorageRules } from '~/models/organization';
import { fetchAndCacheOrganizationStorageRule } from '~/ui/organization-utils';
import { createFetcherLoadHook, createFetcherSubmitHook } from '~/utils/router';

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

export const useStorageRulesLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ organizationId }: { organizationId: string }) => {
      return load(
        href('/organization/:organizationId/storage-rules', {
          organizationId,
        }),
      );
    },
  clientLoader,
);

export const useStorageRulesActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId }: { organizationId: string }) => {
      return submit(
        {},
        {
          method: 'POST',
          action: href('/organization/:organizationId/storage-rules', {
            organizationId,
          }),
        },
      );
    },
  clientAction,
);
