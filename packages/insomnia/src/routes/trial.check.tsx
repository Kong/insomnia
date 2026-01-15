import { getTrialEligibility } from 'insomnia-api';
import { href } from 'react-router';

import { userSession } from '~/models';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/settings.update';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId } = await userSession.get();

  if (!sessionId) {
    return {
      isEligible: false,
    };
  }

  try {
    const check = await getTrialEligibility({ sessionId });
    return {
      isEligible: check.isEligible,
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
