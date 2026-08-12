import { type CurrentPlan, type CurrentUserActionCreateActionTypeEnum, recordUserAction } from 'insomnia-api';
import { v4 as uuidv4 } from 'uuid';

import { getAccountId, getCurrentSessionId } from '~/common/account/session';

const isCurrentAccountOnEnterprisePlan = async (): Promise<boolean> => {
  const accountId = await getAccountId();
  if (!accountId) {
    return false;
  }

  const currentPlan = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}') as CurrentPlan;
  return currentPlan?.type === 'enterprise' || currentPlan?.type === 'enterprise-member';
};

/**
 * POST /v3/users/me/actions. Fire-and-forget: never throws, no-ops when logged out or when the current user isn't on an enterprise plan.
 * Call sites should not await this so it never blocks the calling flow.
 */
export const recordAction = async (actionType: CurrentUserActionCreateActionTypeEnum): Promise<void> => {
  try {
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return;
    }

    const isEnterpriseMember = await isCurrentAccountOnEnterprisePlan();
    if (!isEnterpriseMember) {
      return;
    }

    await recordUserAction({ sessionId, eventId: uuidv4(), actionType });
  } catch (error) {
    console.error('Failed to track user activity', error);
  }
};
