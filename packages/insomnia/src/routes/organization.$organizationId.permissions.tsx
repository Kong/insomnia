import { type Billing, type FeatureList, getOrganizationFeatures, type Organization } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { href, redirect, type ShouldRevalidateFunctionArgs } from 'react-router';

import { mergeKonnectSyncEnabledForOrganization } from '~/ui/organization-utils';
import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.permissions';

export const fallbackFeatures = Object.freeze<FeatureList>({
  bulkImport: { enabled: false, reason: 'Insomnia API unreachable' },
  gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
  orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  aiMockServers: { enabled: false, reason: 'Insomnia API unreachable' },
  aiCommitMessages: { enabled: false, reason: 'Insomnia API unreachable' },
  aiMcpClient: { enabled: false, reason: 'Insomnia API unreachable' },
  konnectSync: { enabled: false, reason: 'Insomnia API unreachable' },
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
  const { id: sessionId, accountId } = await services.userSession.get();

  // Local-only organizations have no server-side representation; must return before the lookup
  // below, which would otherwise bounce the user out to /organization.
  if (models.organization.isLocalOrganizationId(organizationId)) {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
    };
  }

  const organizations = JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];
  const organization = organizations.find(o => o.id === organizationId);

  if (!organization) {
    throw redirect(href('/organization'));
  }

  try {
    const featuresResponse = getOrganizationFeatures({ organizationId, sessionId });

    return {
      featuresPromise: featuresResponse.then(res => {
        const features = res?.features || fallbackFeatures;
        mergeKonnectSyncEnabledForOrganization(accountId, features.konnectSync?.enabled === true);
        return features;
      }),
      billingPromise: featuresResponse.then(res => res?.billing || fallbackBilling),
    };
  } catch {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
    };
  }
}

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return args.currentParams.organizationId !== args.nextParams.organizationId;
}

export const useOrganizationPermissionsLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ organizationId }: { organizationId: string }) => {
      return load(
        href('/organization/:organizationId/permissions', {
          organizationId,
        }),
      );
    },
  clientLoader,
);
