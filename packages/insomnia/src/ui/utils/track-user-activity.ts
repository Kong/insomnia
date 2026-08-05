import type { UserActionType } from 'insomnia-api';
import { trackUserAction } from 'insomnia-api';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentSessionId } from '~/common/account/session';

/**
 * POST /users/me/actions. Fire-and-forget: never throws, no-ops when logged out.
 * Call sites should not await this so it never blocks the calling flow.
 */
export const trackUserActivity = async (actionType: UserActionType): Promise<void> => {
  try {
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return;
    }

    await trackUserAction({ sessionId, eventId: uuidv4(), actionType });
  } catch (error) {
    console.error('Failed to track user activity', error);
  }
};
