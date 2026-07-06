import { describe, expect, it } from 'vitest';

import { getFirstRequestCohort, getFirstRequestTreatment } from './first-request-treatment';

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

describe('getFirstRequestTreatment', () => {
  it('returns "B" for accounts created before the experiment launched, regardless of request count', () => {
    expect(
      getFirstRequestTreatment({
        accountCreatedAt: BEFORE_GA,
        experimentLaunchedAt: GA,
        createdRequests: 0,
        cohortId: 'acct_123',
      }),
    ).toBe('B');
  });

  it('assigns new sign-ups (created on/after GA, fewer than 3 requests) to their cohort', () => {
    const cohort = getFirstRequestCohort('acct_123');
    expect(
      getFirstRequestTreatment({
        accountCreatedAt: AFTER_GA,
        experimentLaunchedAt: GA,
        createdRequests: 0,
        cohortId: 'acct_123',
      }),
    ).toBe(cohort);
  });

  it('graduates a new sign-up to "B" once they have created 3 or more requests', () => {
    expect(
      getFirstRequestTreatment({
        accountCreatedAt: AFTER_GA,
        experimentLaunchedAt: GA,
        createdRequests: 3,
        cohortId: 'acct_123',
      }),
    ).toBe('B');
  });

  it('treats an unknown creation date via the new-sign-up path (cohort / graduation)', () => {
    const cohort = getFirstRequestCohort('acct_123');
    expect(
      getFirstRequestTreatment({
        accountCreatedAt: undefined,
        experimentLaunchedAt: GA,
        createdRequests: 0,
        cohortId: 'acct_123',
      }),
    ).toBe(cohort);
  });
});
