import { type CurrentPlan, getTrialEligibility } from 'insomnia-api';
import { href } from 'react-router';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { createFetcherLoadHook } from '~/utils/router';

interface ResourceUsage {
  mocks: {
    quota: number;
    calls: number;
    autoPurchase: {
      enabled: boolean;
      unit: number;
    };
  };
}

interface EnterpriseOwner {
  id: string;
  name: string;
  role: string;
}

interface AccountUsedSeats {
  memberCount: number;
  inviteCount: number;
  used: number;
  total: number;
}

interface LicenseUsage {
  used: number;
  total: number;
  memberCount: number;
  inviteCount: number;
  free: number;
}

function getResourceUsage(sessionId: string) {
  return insomniaFetch<ResourceUsage>({
    method: 'GET',
    path: '/v1/user/resource-usage',
    sessionId,
  });
}

function getOwnEnterprises(sessionId: string) {
  return insomniaFetch<EnterpriseOwner[]>({
    method: 'GET',
    path: '/v1/user/enterprises',
    sessionId,
  });
}

async function getCurrentEnterprise(sessionId: string) {
  const enterprises = await getOwnEnterprises(sessionId);
  if (!Array.isArray(enterprises)) {
    return null;
  }
  return enterprises.find(ent => ent.role === 'owner') ?? enterprises[0];
}

function getAccountUsedSeats(sessionId: string) {
  return insomniaFetch<AccountUsedSeats>({
    method: 'GET',
    path: '/v1/accounts/seats',
    sessionId,
  });
}

function getEnterpriseLicenseUsage(sessionId: string, enterpriseId: string) {
  return insomniaFetch<LicenseUsage>({
    method: 'GET',
    path: `/v1/enterprise/${enterpriseId}/license-usage`,
    sessionId,
  });
}

function getLicenseUsage(sessionId: string, enterpriseId?: string | null) {
  return enterpriseId ? getEnterpriseLicenseUsage(sessionId, enterpriseId) : getAccountUsedSeats(sessionId);
}

export async function clientLoader() {
  const { id: sessionId, accountId } = await userSession.get();

  if (!sessionId) {
    return {
      resourceUsage: null,
      licenseUsage: null,
      isEligible: false,
    };
  }

  const currentPlan = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}') as CurrentPlan;
  const enterpriseId = currentPlan?.type === 'enterprise' ? (await getCurrentEnterprise(sessionId))?.id : null;
  const [resourceUsage, licenseUsage, trialEligibility] = await Promise.allSettled([
    getResourceUsage(sessionId),
    getLicenseUsage(sessionId, enterpriseId),
    getTrialEligibility({ sessionId }),
  ]);

  return {
    resourceUsage: resourceUsage.status === 'fulfilled' ? resourceUsage.value : null,
    licenseUsage: licenseUsage.status === 'fulfilled' ? licenseUsage.value : null,
    isEligible:
      trialEligibility.status === 'fulfilled' && 'isEligible' in trialEligibility.value
        ? trialEligibility.value?.isEligible
        : false,
  };
}

export const useResourceUsageFetcher = createFetcherLoadHook(
  load => () => {
    return load(href('/resource/usage'));
  },
  clientLoader,
);
