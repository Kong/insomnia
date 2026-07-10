import { latchRequestThresholdReached } from 'insomnia-api';

import { getAccountId, getCurrentSessionId } from '~/common/account/session';

import {
  FIRST_REQUEST_GRADUATION_THRESHOLD,
  isRequestThresholdLatched,
  markRequestThresholdLatched,
  readRequestCountBaseline,
  writeRequestCountBaseline,
} from './first-request-treatment';

/**
 * Latch the sticky "reached the first-request graduation threshold" bit on the
 * server once this install has observed enough created requests.
 *
 * `createdRequests` (from `services.stats`) is a device-wide lifetime counter,
 * not scoped per account — without correction, switching accounts on the same
 * install would let a brand new account inherit requests created by a previous
 * account and latch after a single new request. We snapshot a per-account
 * baseline the first time an account is seen here, and only count requests
 * created since then. All callers pass the raw device-wide count; this is the
 * single place that makes the check account-aware.
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
  try {
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return;
    }
    const accountId = (await getAccountId()) || '';
    if (isRequestThresholdLatched(accountId)) {
      return;
    }

    let baseline = readRequestCountBaseline(accountId);
    if (baseline === null) {
      baseline = createdRequests;
      writeRequestCountBaseline(accountId, baseline);
    }

    if (createdRequests - baseline < FIRST_REQUEST_GRADUATION_THRESHOLD) {
      return;
    }

    await latchRequestThresholdReached({ sessionId });
    markRequestThresholdLatched(accountId);
  } catch (error) {
    // Leave the local flag unset so the (idempotent) latch is retried next time.
    console.error('Failed to latch first-request graduation threshold', error);
  }
};
