import { type LoaderFunctionArgs, redirect } from 'react-router';

import { userSession } from '../../models';
import { isScratchpadOrganizationId, type Organization } from '../../models/organization';
import { insomniaFetch } from '../insomniaFetch';
import type { Billing, FeatureList } from './organization';

export async function loader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params as { organizationId: string };
  const { id: sessionId, accountId } = await userSession.getOrCreate();
  const fallbackFeatures = {
    gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
    orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  };

  // If network unreachable assume user has paid for the current period
  const fallbackBilling = {
    isActive: true,
    expirationWarningMessage: '',
    expirationErrorMessage: '',
    accessDenied: false,
  };

  if (isScratchpadOrganizationId(organizationId)) {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
    };
  }

  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const organization = organizations.find(o => o.id === organizationId);

  if (!organization) {
    throw redirect('/organization');
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
