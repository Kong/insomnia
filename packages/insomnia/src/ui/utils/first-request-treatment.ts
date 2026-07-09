import type { UserOnboardingState } from 'insomnia-api';

export type FirstRequestTreatment = 'A' | 'B';

/**
 * Number of created requests after which a new sign-up graduates from the
 * first-request experience Treatment A to Treatment B.
 *
 * The server owns graduation; the client uses this only to decide when its local
 * created-request count has crossed the threshold and it should latch the sticky
 * bit on the server (see `maybeLatchRequestThreshold`).
 */
export const FIRST_REQUEST_GRADUATION_THRESHOLD = 3;

const CACHE_KEY_PREFIX = 'insomnia.firstRequestTreatment';

/** Experiment name used in analytics (the `experiment_name` column). */
export const FIRST_REQUEST_EXPERIMENT_NAME = 'new_user_first_request_experience';

/** Maps the internal treatment to the analytics `treatment_group` value. */
export const getFirstRequestTreatmentGroup = (treatment: FirstRequestTreatment): 'treatment_a' | 'treatment_b' =>
  treatment === 'A' ? 'treatment_a' : 'treatment_b';

/**
 * Reads the server-computed treatment from the onboarding resource (field
 * `first_request_treatment`). The server is authoritative for assignment; the
 * client does not compute treatment itself. Returns undefined if absent or
 * invalid, so the caller can fall back to the cached value / safe default.
 */
export const getOnboardingTreatment = (
  onboarding: UserOnboardingState | null | undefined,
): FirstRequestTreatment | undefined => {
  const value = onboarding?.first_request_treatment;
  return value === 'A' || value === 'B' ? value : undefined;
};

/**
 * Reads the server's `is_new_signup` flag from the onboarding resource. This is the
 * sole signal for experiment participation (whether to emit assignment analytics);
 * an absent flag means "not a confirmed participant".
 */
export const getOnboardingIsNewSignup = (onboarding: UserOnboardingState | null | undefined): boolean | undefined => {
  const value = onboarding?.is_new_signup;
  return typeof value === 'boolean' ? value : undefined;
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
 * Resolves which treatment to render. The server is authoritative for assignment
 * (treatment, participation and graduation), so the client no longer computes any
 * of it — it only falls back gracefully when the server hasn't answered:
 *
 *   1. Backend-provided treatment (authoritative).
 *   2. Cached last-known treatment (offline / endpoint not yet reached).
 *   3. Safe default (B) once we know the server won't tell us.
 *
 * Returns null only while the first onboarding response is still pending and
 * nothing is cached, so callers can render a neutral state instead of flashing B
 * and then switching.
 */
export const resolveFirstRequestTreatment = ({
  backendTreatment,
  onboardingLoaded,
  cachedTreatment,
}: {
  backendTreatment?: FirstRequestTreatment;
  // Whether the onboarding fetch has settled (resolved or failed).
  onboardingLoaded: boolean;
  cachedTreatment: FirstRequestTreatment | null;
}): FirstRequestTreatment | null => {
  if (backendTreatment) {
    return backendTreatment;
  }
  if (cachedTreatment) {
    return cachedTreatment;
  }
  return onboardingLoaded ? 'B' : null;
};
