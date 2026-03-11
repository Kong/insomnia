import {
  type CurrentPlan,
  getAccountUsedSeats,
  getEnterpriseLicenseUsage,
  getOwnEnterprises,
  getResourceUsage,
  getTrialEligibility,
} from 'insomnia-api';
import { href } from 'react-router';

import { userSession } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

async function getCurrentEnterprise(sessionId: string) {
  const enterprises = await getOwnEnterprises({ sessionId });
  if (!Array.isArray(enterprises)) {
    return null;
  }
  return enterprises.find(ent => ent.role === 'owner') ?? enterprises[0];
}

function getLicenseUsage(sessionId: string, enterpriseId?: string | null) {
  return enterpriseId ? getEnterpriseLicenseUsage({ sessionId, enterpriseId }) : getAccountUsedSeats({ sessionId });
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
    getResourceUsage({ sessionId }),
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
