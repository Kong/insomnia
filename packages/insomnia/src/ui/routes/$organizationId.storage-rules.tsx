import type { LoaderFunctionArgs } from 'react-router';

import { fetchAndCacheOrganizationStorageRule, type StorageRules } from '../organization-utils';

export interface OrganizationStorageLoaderData {
  storagePromise: Promise<StorageRules>;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params as { organizationId: string };
  return {
    storagePromise: fetchAndCacheOrganizationStorageRule(organizationId),
  };
}

export async function action({ params }: LoaderFunctionArgs) {
  const { organizationId } = params;
  await fetchAndCacheOrganizationStorageRule(organizationId, true);
  return null;
}
