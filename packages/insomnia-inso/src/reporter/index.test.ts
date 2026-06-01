import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestTestResult } from '~/insomnia-data';

import { logTestResult, logTestResultSummary, reporterTypes } from './index';

describe('Reporter', () => {
  const log = vi.fn();
  // Sample test data
  const passedTest: RequestTestResult = {
    testCase: 'passed test case',
    status: 'passed',
    errorMessage: '',
    executionTime: 100,
    category: 'pre-request',
  };
  const failedTest: RequestTestResult = {
    testCase: 'failed test case',
    status: 'failed',
    errorMessage: 'Test failed error',
    executionTime: 200,
    category: 'after-response',
  };

  beforeEach(() => {
    log.mockClear();
  });

  describe('logTestResult', () => {
    it.each(reporterTypes)('should log test results with %s reporter', reporter => {
      // Test with mix of passed and failed tests
      const testResults = [passedTest, failedTest, passedTest];

      logTestResult(reporter, testResults, log);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should handle empty test results', () => {
      logTestResult('dot', [], log);
      expect(log).not.toHaveBeenCalled();

      logTestResult('dot', undefined, log);
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('logTestResultSummary', () => {
    it('should handle empty test results queue', () => {
      logTestResultSummary([], log);

      expect(log).not.toHaveBeenCalled();
    });

    it('should log summary for all passed tests', () => {
      const testResultsQueue = [[passedTest, passedTest], [passedTest], [passedTest, passedTest, passedTest]];

      logTestResultSummary(testResultsQueue, log);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should log summary for all failed tests', () => {
      const testResultsQueue = [[failedTest, failedTest], [failedTest], [failedTest, failedTest]];

      logTestResultSummary(testResultsQueue, log);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should log summary for mixed test results', () => {
      const testResultsQueue = [
        [passedTest, failedTest],
        [passedTest, passedTest],
        [failedTest, failedTest, passedTest],
      ];

      logTestResultSummary(testResultsQueue, log);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should handle requests with empty test results', () => {
      const testResultsQueue = [[], [passedTest, failedTest], []];

      logTestResultSummary(testResultsQueue, log);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
