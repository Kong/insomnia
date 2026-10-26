import type { RequestTestResult } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { filterTestResults, hasMatchingTestResults, isFilterEngaged } from '../request-test-result-pane';

const testResult = (overrides: Partial<RequestTestResult> = {}): RequestTestResult => ({
  testCase: 'renders a response',
  status: 'passed',
  executionTime: 1,
  category: 'after-response',
  ...overrides,
});

describe('filterTestResults', () => {
  const results: RequestTestResult[] = [
    testResult({ testCase: 'status code is 200', status: 'passed' }),
    testResult({ testCase: 'has expected body', status: 'failed' }),
    testResult({ testCase: 'pre-request runs', status: 'skipped' }),
  ];

  it('returns everything, with original indexes, when targetTests is "all" and there is no text filter', () => {
    expect(filterTestResults(results, 'all', '')).toEqual([
      { result: results[0], index: 0 },
      { result: results[1], index: 1 },
      { result: results[2], index: 2 },
    ]);
  });

  it('filters to only passed results', () => {
    expect(filterTestResults(results, 'passed', '')).toEqual([{ result: results[0], index: 0 }]);
  });

  it('filters to only failed results', () => {
    expect(filterTestResults(results, 'failed', '')).toEqual([{ result: results[1], index: 1 }]);
  });

  it('filters to only skipped results', () => {
    expect(filterTestResults(results, 'skipped', '')).toEqual([{ result: results[2], index: 2 }]);
  });

  it('applies the text filter on top of the status filter', () => {
    expect(filterTestResults(results, 'all', 'expected')).toEqual([{ result: results[1], index: 1 }]);
  });

  it('returns nothing when the text filter matches no test case in the selected status', () => {
    expect(filterTestResults(results, 'passed', 'expected')).toEqual([]);
  });

  it('ignores a whitespace-only text filter', () => {
    expect(filterTestResults(results, 'all', '   ')).toHaveLength(3);
  });

  it('returns an empty array when there are no test results to filter', () => {
    expect(filterTestResults([], 'all', '')).toEqual([]);
    expect(filterTestResults([], 'passed', '')).toEqual([]);
  });
});

describe('isFilterEngaged', () => {
  it('is not engaged for the default "all" status with no text filter', () => {
    expect(isFilterEngaged('all', '')).toBe(false);
  });

  it('is not engaged when the text filter is only whitespace', () => {
    expect(isFilterEngaged('all', '   ')).toBe(false);
  });

  it('is engaged when a non-"all" status is selected', () => {
    expect(isFilterEngaged('passed', '')).toBe(true);
    expect(isFilterEngaged('failed', '')).toBe(true);
    expect(isFilterEngaged('skipped', '')).toBe(true);
  });

  it('is engaged when a text filter is present', () => {
    expect(isFilterEngaged('all', 'expected')).toBe(true);
  });
});

describe('hasMatchingTestResults', () => {
  const results: RequestTestResult[] = [testResult({ testCase: 'status code is 200', status: 'passed' })];

  it('is true when no filter is engaged, even with no test results at all', () => {
    expect(hasMatchingTestResults([], 'all', '')).toBe(true);
    expect(hasMatchingTestResults(results, 'all', '')).toBe(true);
  });

  it('is true when a filter is engaged and at least one result matches', () => {
    expect(hasMatchingTestResults(results, 'passed', '')).toBe(true);
  });

  it('is false when a status filter is engaged and no result matches', () => {
    expect(hasMatchingTestResults(results, 'failed', '')).toBe(false);
    expect(hasMatchingTestResults(results, 'skipped', '')).toBe(false);
  });

  it('is false when a status filter is engaged and there are no results at all', () => {
    expect(hasMatchingTestResults([], 'failed', '')).toBe(false);
  });

  it('is false when a text filter is engaged and no result matches', () => {
    expect(hasMatchingTestResults(results, 'all', 'nonexistent test name')).toBe(false);
  });

  it('is true when a text filter is engaged and a result matches', () => {
    expect(hasMatchingTestResults(results, 'all', 'status code')).toBe(true);
  });
});
