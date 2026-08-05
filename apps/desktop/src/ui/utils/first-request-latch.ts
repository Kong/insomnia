import { getOnboardingState, latchRequestThresholdReached } from 'insomnia-api';

import { getAccountId, getCurrentSessionId } from '~/common/account/session';
import { AnalyticsEvent } from '~/ui/analytics';

import {
  FIRST_REQUEST_EXPERIMENT_NAME,
  FIRST_REQUEST_GRADUATION_THRESHOLD,
  getFirstRequestTreatmentGroup,
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
 * Also emits the graduation (A→B) assignment analytics event here, not from the
 * first-request UI — this is the one place graduation is guaranteed to be
 * detected, since by the time an account has crossed the threshold it usually
 * won't re-render the first-request empty-state pane that would otherwise need
 * to observe the transition.
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

    // Best-effort, decoupled from the latch itself: a failure here shouldn't
    // retry the (already-confirmed) latch, so it isn't awaited or folded into
    // the outer try/catch.
    getOnboardingState({ sessionId })
      .then(onboarding => {
        // Only participants emit assignment analytics; a missing/failed onboarding
        // fetch means "not a confirmed participant".
        if (onboarding?.is_new_signup === true) {
          window.main.trackAnalyticsEvent({
            event: AnalyticsEvent.experimentAssigned,
            properties: {
              experiment_name: FIRST_REQUEST_EXPERIMENT_NAME,
              treatment_group: getFirstRequestTreatmentGroup('B'),
              assigned_at: new Date().toISOString(),
            },
          });
        }
      })
      .catch(error => {
        console.error('Failed to emit first-request graduation analytics event', error);
      });
  } catch (error) {
    // Leave the local flag unset so the (idempotent) latch is retried next time.
    console.error('Failed to latch first-request graduation threshold', error);
  }
};
