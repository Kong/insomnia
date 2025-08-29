import { useEffect } from 'react';
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
    if (!isScratchpadOrganizationId(organizationId) && isIdleAndUninitialized) {
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
