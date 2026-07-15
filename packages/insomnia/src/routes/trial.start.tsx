import { startTrial } from 'insomnia-api';
import { services } from 'insomnia-data';

import { syncCurrentPlan } from '~/ui/organization-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/settings.update';

export async function clientAction(_args: Route.ClientActionArgs) {
  const { id: sessionId, accountId } = await services.userSession.get();

  if (!sessionId || !accountId) {
    return {
      success: false,
    };
  }

  try {
    const result = await startTrial({ sessionId });
    if (result.success) {
      await syncCurrentPlan(sessionId, accountId);
    }
    return result;
  } catch {
    return {
      success: false,
    };
  }
}

export const useTrialStartActionFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit(null, {
      method: 'POST',
      action: '/trial/start',
      encType: 'application/json',
    });
  },
  clientAction,
);
