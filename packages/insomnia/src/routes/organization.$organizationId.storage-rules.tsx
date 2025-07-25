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
  const fetcher = useFetcher<typeof clientLoader>(args);

  function load({
    organizationId,
  }: {
    organizationId: string;
  }) {
    return fetcher.load(
      href('/organization/:organizationId/storage-rules', {
        organizationId,
      }),
    );
  }

  return {
    ...fetcher,
    load,
  };
}

export function useStorageRulesActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
  }: {
    organizationId: string;
  }) {
    return fetcher.submit(
      {},
      {
        method: 'POST',
        action: href('/organization/:organizationId/storage-rules', {
          organizationId,
        }),
      },
    );
  }

  return {
    ...fetcher,
    submit,
  };
}
