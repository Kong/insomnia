import { latchRequestThresholdReached } from 'insomnia-api';

import { getAccountId, getCurrentSessionId } from '~/common/account/session';

import { FIRST_REQUEST_GRADUATION_THRESHOLD, isRequestThresholdLatched, markRequestThresholdLatched } from './first-request-treatment';

/**
 * Latch the sticky "reached the first-request graduation threshold" bit on the
 * server once this install has observed enough created requests.
 *
 * Instead of reporting a delta per request (which undercounts when calls drop),
 * we send one idempotent latch when the local count crosses the threshold. The
 * call is safe to repeat: it's guarded by a local flag to avoid needless POSTs,
 * but a dropped call self-heals because the guard is only set after the server
 * confirms, so the next request creation / pane load retries it.
 *
 * Fire-and-forget: never throws, and no-ops when logged out or below threshold.
 */
export const maybeLatchRequestThreshold = async (createdRequests: number): Promise<void> => {
  if (createdRequests < FIRST_REQUEST_GRADUATION_THRESHOLD) {
    return;
  }

  try {
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return;
    }
    const accountId = (await getAccountId()) || '';
    if (isRequestThresholdLatched(accountId)) {
      return;
    }
    await latchRequestThresholdReached({ sessionId });
    markRequestThresholdLatched(accountId);
  } catch (error) {
    // Leave the local flag unset so the (idempotent) latch is retried next time.
    console.error('Failed to latch first-request graduation threshold', error);
  }
};
