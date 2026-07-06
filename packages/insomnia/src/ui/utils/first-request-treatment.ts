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
 * - A new sign-up in Treatment A graduates to B once they have created
 *   {@link FIRST_REQUEST_GRADUATION_THRESHOLD} or more requests.
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

/**
 * Reads the server-computed treatment from the user profile, when the backend
 * provides it (field `first_request_treatment`). Returns undefined if absent or
 * invalid, so the caller can fall back to the client-side computation.
 *
 * Typed as `unknown` because the generated `User` SDK type does not include the
 * field yet; remove the cast once the SDK is regenerated with it.
 */
export const getBackendFirstRequestTreatment = (user: unknown): FirstRequestTreatment | undefined => {
  const value = (user as { first_request_treatment?: unknown } | null | undefined)?.first_request_treatment;
  return value === 'A' || value === 'B' ? value : undefined;
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
  createdRequests,
  cohortId,
  cachedTreatment,
}: {
  backendTreatment?: FirstRequestTreatment;
  accountCreatedAt?: number;
  experimentLaunchedAt: number;
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
    // New sign-ups need the created-request count to decide graduation.
    if (createdRequests !== null) {
      return getFirstRequestTreatment({ accountCreatedAt, experimentLaunchedAt, createdRequests, cohortId });
    }
    // Stats still loading: prefer a cached value over showing nothing.
    return cachedTreatment;
  }

  // 3) Profile unavailable (offline / failed): last-known, else safe default.
  return cachedTreatment ?? 'B';
};
