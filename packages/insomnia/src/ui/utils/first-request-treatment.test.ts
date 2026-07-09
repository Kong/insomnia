import { describe, expect, it } from 'vitest';

import {
  getFirstRequestTreatmentGroup,
  getOnboardingIsNewSignup,
  getOnboardingTreatment,
  resolveFirstRequestTreatment,
} from './first-request-treatment';

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

describe('resolveFirstRequestTreatment (fallback chain)', () => {
  const base = {
    onboardingLoaded: true,
    cachedTreatment: null,
  };

  it('1) uses the backend treatment when present, ignoring everything else', () => {
    expect(resolveFirstRequestTreatment({ ...base, backendTreatment: 'A', cachedTreatment: 'B' })).toBe('A');
  });

  it('2) falls back to the cached last-known treatment when the backend has not answered', () => {
    expect(resolveFirstRequestTreatment({ ...base, cachedTreatment: 'A' })).toBe('A');
  });

  it('3) returns null while the first response is still pending and nothing is cached', () => {
    expect(resolveFirstRequestTreatment({ ...base, onboardingLoaded: false, cachedTreatment: null })).toBeNull();
  });

  it('4) defaults to "B" once loaded with no backend treatment and nothing cached', () => {
    expect(resolveFirstRequestTreatment({ ...base, onboardingLoaded: true, cachedTreatment: null })).toBe('B');
  });
});
