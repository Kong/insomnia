import { type Billing, type FeatureList, getOrganizationFeatures, type Organization } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { href, redirect, type ShouldRevalidateFunctionArgs } from 'react-router';

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

  if (models.organization.isScratchpadOrganizationId(organizationId)) {
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
    const featuresResponse = getOrganizationFeatures({ organizationId, sessionId });

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
