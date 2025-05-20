import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestTestResult } from '../../../insomnia-scripting-environment/src/objects';
import { logTestResult, logTestResultSummary, reporterTypes } from './index';

describe('Reporter', () => {
  // Mock console.log
  const originalConsoleLog = console.log;
  const mockConsoleLog = vi.fn();

  beforeEach(() => {
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

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

  describe('logTestResult', () => {
    it.each(reporterTypes)('should log test results with %s reporter', reporter => {
      // Test with mix of passed and failed tests
      const testResults = [passedTest, failedTest, passedTest];

      logTestResult(reporter, testResults);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should handle empty test results', () => {
      logTestResult('dot', []);

      expect(mockConsoleLog).not.toHaveBeenCalled();

      logTestResult('dot', undefined);

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('logTestResultSummary', () => {
    it('should handle empty test results queue', () => {
      logTestResultSummary([]);

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should log summary for all passed tests', () => {
      const testResultsQueue = [[passedTest, passedTest], [passedTest], [passedTest, passedTest, passedTest]];

      logTestResultSummary(testResultsQueue);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should log summary for all failed tests', () => {
      const testResultsQueue = [[failedTest, failedTest], [failedTest], [failedTest, failedTest]];

      logTestResultSummary(testResultsQueue);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should log summary for mixed test results', () => {
      const testResultsQueue = [
        [passedTest, failedTest],
        [passedTest, passedTest],
        [failedTest, failedTest, passedTest],
      ];

      logTestResultSummary(testResultsQueue);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should handle requests with empty test results', () => {
      const testResultsQueue = [[], [passedTest, failedTest], []];

      logTestResultSummary(testResultsQueue);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
