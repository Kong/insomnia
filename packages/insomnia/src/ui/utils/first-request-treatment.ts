import type { UserOnboardingState } from 'insomnia-api';

export type FirstRequestTreatment = 'A' | 'B';

/**
 * Number of created requests after which a new sign-up graduates from the
 * first-request experience Treatment A to Treatment B.
 */
export const FIRST_REQUEST_GRADUATION_THRESHOLD = 3;

/**
 * v13.1.0 GA release date (epoch ms). Only used by the client-side fallback when
 * the backend does not (yet) return a treatment. Accounts created before this are
 * treated as pre-existing users (Treatment B).
 *
 * TODO(INS-2933): set to the actual v13.1.0 GA date before release.
 */
export const FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE = Date.parse('2026-07-18T00:00:00.000Z');

const CACHE_KEY_PREFIX = 'insomnia.firstRequestTreatment';

/** Experiment name used in analytics (the `experiment_name` column). */
export const FIRST_REQUEST_EXPERIMENT_NAME = 'new_user_first_request_experience';

/** Maps the internal treatment to the analytics `treatment_group` value. */
export const getFirstRequestTreatmentGroup = (treatment: FirstRequestTreatment): 'treatment_a' | 'treatment_b' =>
  treatment === 'A' ? 'treatment_a' : 'treatment_b';

/**
 * Deterministic ~50/50 cohort assignment for the first-request experiment.
 *
 * Used only by the client-side fallback (the backend is authoritative when it
 * returns a treatment). Buckets a user by hashing a stable id (accountId, falling
 * back to deviceId); stable per user, needs no stored state, splits ~50/50.
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
 * Pure client-side treatment computation (the fallback used when the backend does
 * not return a treatment).
 *
 * - Accounts created before the experiment launched are existing users → B.
 * - New sign-ups are split ~50/50 into A or B by {@link getFirstRequestCohort}.
 * - A new sign-up in Treatment A graduates to B once they have graduated (created
 *   at least {@link FIRST_REQUEST_GRADUATION_THRESHOLD} requests — a sticky fact).
 */
export const getFirstRequestTreatment = ({
  accountCreatedAt,
  experimentLaunchedAt,
  hasGraduated,
  cohortId,
}: {
  accountCreatedAt?: number;
  experimentLaunchedAt: number;
  hasGraduated: boolean;
  cohortId: string;
}): FirstRequestTreatment => {
  if (accountCreatedAt !== undefined && accountCreatedAt < experimentLaunchedAt) {
    return 'B';
  }

  if (hasGraduated) {
    return 'B';
  }

  return getFirstRequestCohort(cohortId);
};

/**
 * Reads the server-computed treatment from the onboarding resource, when the
 * backend is steering assignment (field `first_request_treatment`). Returns
 * undefined if absent or invalid, so the caller can fall back to the client-side
 * computation.
 */
export const getOnboardingTreatment = (
  onboarding: UserOnboardingState | null | undefined,
): FirstRequestTreatment | undefined => {
  const value = onboarding?.first_request_treatment;
  return value === 'A' || value === 'B' ? value : undefined;
};

/**
 * Reads the server's `is_new_signup` flag from the onboarding resource, when
 * provided. Used to decide whether the user is an experiment participant.
 */
export const getOnboardingIsNewSignup = (onboarding: UserOnboardingState | null | undefined): boolean | undefined => {
  const value = onboarding?.is_new_signup;
  return typeof value === 'boolean' ? value : undefined;
};

/**
 * Reads the sticky "reached the graduation threshold" latch from the onboarding
 * resource. This is the account-wide, device-independent, irreversible source of
 * truth for graduation; defaults to false when the server hasn't confirmed it.
 */
export const getOnboardingReachedThreshold = (onboarding: UserOnboardingState | null | undefined): boolean => {
  return onboarding?.has_reached_request_threshold === true;
};

/**
 * Whether the user is part of the experiment population (a genuine new sign-up),
 * as opposed to a pre-existing user who is simply defaulted to Treatment B.
 *
 * Prefers the server `is_new_signup` flag; otherwise derives it from the account
 * creation date vs GA. Returns false when neither is known (can't confirm → don't
 * emit assignment analytics).
 */
export const isFirstRequestExperimentParticipant = ({
  isNewSignup,
  accountCreatedAt,
  experimentLaunchedAt,
}: {
  isNewSignup?: boolean;
  accountCreatedAt?: number;
  experimentLaunchedAt: number;
}): boolean => {
  if (isNewSignup !== undefined) {
    return isNewSignup;
  }
  if (accountCreatedAt !== undefined) {
    return accountCreatedAt >= experimentLaunchedAt;
  }
  return false;
};

const cacheKey = (accountId: string) => `${CACHE_KEY_PREFIX}:${accountId || 'anonymous'}`;

/** Last-known treatment for this account, used as an offline fallback. */
export const readCachedFirstRequestTreatment = (accountId: string): FirstRequestTreatment | null => {
  try {
    const value = window.localStorage.getItem(cacheKey(accountId));
    return value === 'A' || value === 'B' ? value : null;
  } catch {
    return null;
  }
};

export const writeCachedFirstRequestTreatment = (accountId: string, treatment: FirstRequestTreatment): void => {
  try {
    window.localStorage.setItem(cacheKey(accountId), treatment);
  } catch {
    // Ignore storage failures (e.g. private mode / quota).
  }
};

const LATCH_KEY_PREFIX = 'insomnia.firstRequestThresholdLatched';
const latchKey = (accountId: string) => `${LATCH_KEY_PREFIX}:${accountId || 'anonymous'}`;

/**
 * Whether this install has already confirmed the graduation-threshold latch with
 * the server for this account. Purely a local optimisation to avoid re-POSTing an
 * idempotent latch — the server remains the source of truth.
 */
export const isRequestThresholdLatched = (accountId: string): boolean => {
  try {
    return window.localStorage.getItem(latchKey(accountId)) === '1';
  } catch {
    return false;
  }
};

export const markRequestThresholdLatched = (accountId: string): void => {
  try {
    window.localStorage.setItem(latchKey(accountId), '1');
  } catch {
    // Ignore storage failures; we simply retry the (idempotent) latch next time.
  }
};

/**
 * Resolves the treatment through a fallback chain so the experience is robust
 * offline and whether or not the backend has shipped its field yet:
 *
 *   1. Backend-provided treatment (authoritative).
 *   2. Client-side computation (when the profile is available).
 *   3. Cached last-known treatment (offline / while stats load).
 *   4. Safe default (B) when nothing else is known.
 *
 * Returns null only while a client-side result is still pending (stats loading),
 * so callers can render a neutral state instead of flickering.
 */
export const resolveFirstRequestTreatment = ({
  backendTreatment,
  accountCreatedAt,
  experimentLaunchedAt,
  hasReachedThreshold,
  createdRequests,
  cohortId,
  cachedTreatment,
}: {
  backendTreatment?: FirstRequestTreatment;
  accountCreatedAt?: number;
  experimentLaunchedAt: number;
  // Sticky server-confirmed graduation latch; decides B on its own when true.
  hasReachedThreshold: boolean;
  // Local per-install created-request count (null while still loading).
  createdRequests: number | null;
  cohortId: string;
  cachedTreatment: FirstRequestTreatment | null;
}): FirstRequestTreatment | null => {
  // 1) Backend is authoritative when present.
  if (backendTreatment) {
    return backendTreatment;
  }

  // 2) Client-side fallback when the profile loaded.
  if (accountCreatedAt !== undefined) {
    // Existing users are decided without waiting for local stats.
    if (accountCreatedAt < experimentLaunchedAt) {
      return 'B';
    }
    // Server-confirmed graduation is definitive and needs no local stats.
    if (hasReachedThreshold) {
      return 'B';
    }
    // Otherwise fall back to the local created-request count for graduation.
    if (createdRequests !== null) {
      return getFirstRequestTreatment({
        accountCreatedAt,
        experimentLaunchedAt,
        hasGraduated: createdRequests >= FIRST_REQUEST_GRADUATION_THRESHOLD,
        cohortId,
      });
    }
    // Stats still loading: prefer a cached value over showing nothing.
    return cachedTreatment;
  }

  // 3) Profile unavailable (offline / failed): last-known, else safe default.
  return cachedTreatment ?? 'B';
};
