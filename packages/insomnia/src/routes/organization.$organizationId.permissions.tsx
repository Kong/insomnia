import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import { userSession } from '~/models';
import { isScratchpadOrganizationId, type Organization } from '~/models/organization';
import { insomniaFetch } from '~/ui/insomniaFetch';

import type { Route } from './+types/organization.$organizationId.permissions';
import type { Billing, FeatureList } from './organization';

export const fallbackFeatures = Object.freeze<FeatureList>({
  bulkImport: { enabled: false, reason: 'Insomnia API unreachable' },
  gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
  orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
});

// If network unreachable assume user has paid for the current period
export const fallbackBilling = Object.freeze<Billing>({
  isActive: true,
  expirationWarningMessage: '',
  expirationErrorMessage: '',
  accessDenied: false,
});

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId } = params;
  const { id: sessionId, accountId } = await userSession.getOrCreate();

  if (isScratchpadOrganizationId(organizationId)) {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
    };
  }

  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const organization = organizations.find(o => o.id === organizationId);

  if (!organization) {
    throw redirect(href('/organization'));
  }

  try {
    const featuresResponse = insomniaFetch<{ features: FeatureList; billing: Billing } | undefined>({
      method: 'GET',
      path: `/v1/organizations/${organizationId}/features`,
      sessionId,
    });

    return {
      featuresPromise: featuresResponse.then(res => res?.features || fallbackFeatures),
      billingPromise: featuresResponse.then(res => res?.billing || fallbackBilling),
    };
  } catch {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
    };
  }
}

export function useOrganizationPermissionsLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(
    ({ organizationId }: { organizationId: string }) => {
      return fetcherLoad(
        href('/organization/:organizationId/permissions', {
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
