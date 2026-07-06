export type FirstRequestTreatment = 'A' | 'B';

/**
 * Number of created requests after which a new sign-up graduates from the
 * first-request experience Treatment A to Treatment B.
 */
export const FIRST_REQUEST_GRADUATION_THRESHOLD = 3;

/**
 * v13.1.0 GA release date (epoch ms). Accounts created before this are considered
 * pre-existing users and always get Treatment B ("fresh slate" at launch); only
 * accounts created on/after this date enter the A/B experiment.
 *
 * TODO(INS-2933): set to the actual v13.1.0 GA date before release.
 */
export const FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE = Date.parse('2026-07-06T00:00:00.000Z');

/**
 * Deterministic ~50/50 cohort assignment for the first-request experiment.
 *
 * There is no A/B framework, so we bucket each user by hashing a stable id
 * (accountId, falling back to deviceId). This is stable per user across sessions
 * and devices (when keyed on accountId) and needs no stored state. Over the whole
 * sign-up population the parity of the hash splits ~50/50 between A and B.
 */
export const getFirstRequestCohort = (id: string): FirstRequestTreatment => {
  if (!id) {
    return 'B';
  }

  // Bounded polynomial rolling hash (mod a large prime) so it stays a safe integer
  // and is deterministic; its parity gives a ~50/50 split across the population.
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + (id.codePointAt(i) ?? 0)) % 2_147_483_647;
  }

  return hash % 2 === 0 ? 'A' : 'B';
};

/**
 * Decides which first-request experience treatment to show.
 *
 * - Users whose account was created before the experiment launched are existing
 *   users and always get Treatment B (regardless of how many requests they've made).
 * - New sign-ups are split ~50/50 into Treatment A or B by {@link getFirstRequestCohort}.
 * - A new sign-up in Treatment A graduates to Treatment B once they have created
 *   {@link FIRST_REQUEST_GRADUATION_THRESHOLD} or more requests.
 *
 * `accountCreatedAt` is the account creation time (epoch ms); when undefined (e.g.
 * the profile hasn't loaded) we can't confirm they're pre-existing, so we treat
 * them via the new-sign-up path.
 */
export const getFirstRequestTreatment = ({
  accountCreatedAt,
  experimentLaunchedAt,
  createdRequests,
  cohortId,
}: {
  accountCreatedAt?: number;
  experimentLaunchedAt: number;
  createdRequests: number;
  cohortId: string;
}): FirstRequestTreatment => {
  if (accountCreatedAt !== undefined && accountCreatedAt < experimentLaunchedAt) {
    return 'B';
  }

  if (createdRequests >= FIRST_REQUEST_GRADUATION_THRESHOLD) {
    return 'B';
  }

  return getFirstRequestCohort(cohortId);
};
