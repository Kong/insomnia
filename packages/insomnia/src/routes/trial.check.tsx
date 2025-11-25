import { href } from 'react-router';

import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/settings.update';

interface Eligible {
  isEligible: boolean;
}

export function getTrialEligibility(sessionId: string) {
  return insomniaFetch<Eligible | { error: string }>({
    method: 'GET',
    path: '/v1/trials/eligibility',
    sessionId,
  });
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId } = await userSession.get();

  if (!sessionId) {
    return {
      isEligible: false,
    };
  }

  try {
    const check = await getTrialEligibility(sessionId);
    return {
      isEligible: 'isEligible' in check ? check.isEligible : false,
    };
  } catch {
    return {
      isEligible: false,
    };
  }
}

export const useTrialCheckLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(href('/trial/check'));
  },
  clientLoader,
);
