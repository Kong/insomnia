import { describe, expect, it } from 'vitest';

import {
  getFirstRequestCohort,
  getFirstRequestTreatment,
  getFirstRequestTreatmentGroup,
  getOnboardingIsNewSignup,
  getOnboardingReachedThreshold,
  getOnboardingTreatment,
  isFirstRequestExperimentParticipant,
  resolveFirstRequestTreatment,
} from './first-request-treatment';

const GA = Date.parse('2026-07-06T00:00:00.000Z');
const BEFORE_GA = GA - 60 * 60 * 1000; // 1h before GA
const AFTER_GA = GA + 60 * 60 * 1000; // 1h after GA

describe('getFirstRequestCohort', () => {
  it('is deterministic for the same id', () => {
    expect(getFirstRequestCohort('acct_123')).toBe(getFirstRequestCohort('acct_123'));
  });

  it('splits a population of ids across both cohorts (~50/50)', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `acct_${i}`);
    const cohorts = ids.map(getFirstRequestCohort);
    const aCount = cohorts.filter(c => c === 'A').length;
    expect(cohorts).toContain('A');
    expect(cohorts).toContain('B');
    expect(aCount).toBeGreaterThan(ids.length * 0.3);
    expect(aCount).toBeLessThan(ids.length * 0.7);
  });

  it('defaults to Treatment B when there is no stable id', () => {
    expect(getFirstRequestCohort('')).toBe('B');
  });
});

describe('getFirstRequestTreatment (client-side fallback)', () => {
  it('returns "B" for accounts created before the experiment launched', () => {
    expect(
      getFirstRequestTreatment({ accountCreatedAt: BEFORE_GA, experimentLaunchedAt: GA, hasGraduated: false, cohortId: 'acct_123' }),
    ).toBe('B');
  });

  it('assigns new sign-ups (created on/after GA, not graduated) to their cohort', () => {
    const cohort = getFirstRequestCohort('acct_123');
    expect(
      getFirstRequestTreatment({ accountCreatedAt: AFTER_GA, experimentLaunchedAt: GA, hasGraduated: false, cohortId: 'acct_123' }),
    ).toBe(cohort);
  });

  it('graduates a new sign-up to "B" once they have graduated', () => {
    expect(
      getFirstRequestTreatment({ accountCreatedAt: AFTER_GA, experimentLaunchedAt: GA, hasGraduated: true, cohortId: 'acct_123' }),
    ).toBe('B');
  });
});

describe('getFirstRequestTreatmentGroup', () => {
  it('maps the internal treatment to the analytics treatment_group', () => {
    expect(getFirstRequestTreatmentGroup('A')).toBe('treatment_a');
    expect(getFirstRequestTreatmentGroup('B')).toBe('treatment_b');
  });
});

describe('getOnboardingTreatment', () => {
  it('reads a valid treatment from the onboarding state', () => {
    expect(getOnboardingTreatment({ first_request_treatment: 'A' })).toBe('A');
    expect(getOnboardingTreatment({ first_request_treatment: 'B' })).toBe('B');
  });

  it('returns undefined when the field is missing or invalid', () => {
    expect(getOnboardingTreatment({})).toBeUndefined();
    expect(getOnboardingTreatment(null)).toBeUndefined();
    expect(getOnboardingTreatment({ first_request_treatment: 'C' as unknown as 'A' })).toBeUndefined();
  });
});

describe('getOnboardingIsNewSignup', () => {
  it('reads a boolean flag from the onboarding state, else undefined', () => {
    expect(getOnboardingIsNewSignup({ is_new_signup: true })).toBe(true);
    expect(getOnboardingIsNewSignup({ is_new_signup: false })).toBe(false);
    expect(getOnboardingIsNewSignup({})).toBeUndefined();
    expect(getOnboardingIsNewSignup(null)).toBeUndefined();
  });
});

describe('getOnboardingReachedThreshold', () => {
  it('is true only when the server confirms the sticky latch', () => {
    expect(getOnboardingReachedThreshold({ has_reached_request_threshold: true })).toBe(true);
    expect(getOnboardingReachedThreshold({ has_reached_request_threshold: false })).toBe(false);
    expect(getOnboardingReachedThreshold({})).toBe(false);
    expect(getOnboardingReachedThreshold(null)).toBe(false);
  });
});

describe('isFirstRequestExperimentParticipant', () => {
  it('prefers the server is_new_signup flag when provided', () => {
    expect(isFirstRequestExperimentParticipant({ isNewSignup: true, accountCreatedAt: BEFORE_GA, experimentLaunchedAt: GA })).toBe(true);
    expect(isFirstRequestExperimentParticipant({ isNewSignup: false, accountCreatedAt: AFTER_GA, experimentLaunchedAt: GA })).toBe(false);
  });

  it('falls back to created_at >= GA when the flag is absent', () => {
    expect(isFirstRequestExperimentParticipant({ accountCreatedAt: AFTER_GA, experimentLaunchedAt: GA })).toBe(true);
    expect(isFirstRequestExperimentParticipant({ accountCreatedAt: BEFORE_GA, experimentLaunchedAt: GA })).toBe(false);
  });

  it('returns false when neither signal is known', () => {
    expect(isFirstRequestExperimentParticipant({ experimentLaunchedAt: GA })).toBe(false);
  });
});

describe('resolveFirstRequestTreatment (fallback chain)', () => {
  const base = {
    experimentLaunchedAt: GA,
    hasReachedThreshold: false,
    createdRequests: 0 as number | null,
    cohortId: 'acct_123',
    cachedTreatment: null,
  };

  it('1) uses the backend treatment when present, ignoring everything else', () => {
    expect(
      resolveFirstRequestTreatment({
        ...base,
        backendTreatment: 'A',
        accountCreatedAt: BEFORE_GA,
        hasReachedThreshold: true,
        createdRequests: 99,
      }),
    ).toBe('A');
  });

  it('2) falls back to the client computation when the profile is loaded but no backend field', () => {
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: BEFORE_GA })).toBe('B');
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: AFTER_GA, createdRequests: 3 })).toBe('B');
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: AFTER_GA, createdRequests: 0 })).toBe(
      getFirstRequestCohort('acct_123'),
    );
  });

  it('2a) the server-confirmed graduation latch decides "B" without needing local stats', () => {
    expect(
      resolveFirstRequestTreatment({ ...base, accountCreatedAt: AFTER_GA, hasReachedThreshold: true, createdRequests: null }),
    ).toBe('B');
  });

  it('2b) decides existing users before stats load; waits (or uses cache) for new users', () => {
    // created before GA → B without needing stats
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: BEFORE_GA, createdRequests: null })).toBe('B');
    // new user, stats still loading, no cache → null (loading)
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: AFTER_GA, createdRequests: null })).toBeNull();
    // new user, stats still loading, but cached → cached value
    expect(
      resolveFirstRequestTreatment({ ...base, accountCreatedAt: AFTER_GA, createdRequests: null, cachedTreatment: 'A' }),
    ).toBe('A');
  });

  it('3) uses the cached value when the profile is unavailable (offline)', () => {
    expect(
      resolveFirstRequestTreatment({ ...base, accountCreatedAt: undefined, createdRequests: null, cachedTreatment: 'A' }),
    ).toBe('A');
  });

  it('4) defaults to "B" when the profile is unavailable and nothing is cached', () => {
    expect(resolveFirstRequestTreatment({ ...base, accountCreatedAt: undefined, createdRequests: null })).toBe('B');
  });
});
