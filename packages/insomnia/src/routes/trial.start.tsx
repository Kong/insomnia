import { userSession } from '~/models';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { syncCurrentPlan } from '~/ui/organization-utils';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/settings.update';

interface StartResult {
  success: boolean;
}

export async function clientAction(_args: Route.ClientActionArgs) {
  const { id: sessionId, accountId } = await userSession.get();

  if (!sessionId || !accountId) {
    return {
      success: false,
    };
  }

  try {
    const result = await insomniaFetch<StartResult>({
      method: 'POST',
      path: '/v1/trials/start',
      sessionId,
    });
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
