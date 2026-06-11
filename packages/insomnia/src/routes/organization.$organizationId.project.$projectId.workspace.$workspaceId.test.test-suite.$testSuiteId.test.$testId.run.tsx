import type { TestResults, UnitTest } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { generate, type Test } from 'insomnia-testing/src/generate/generate';
import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import { AnalyticsEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.run';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId, testId } = params;

  const unitTest = await database.findOne<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  const tests: Test[] = [
    {
      name: unitTest.name,
      code: unitTest.code,
      defaultRequestId: unitTest.requestId,
    },
  ];
  const src = generate([{ name: 'My Suite', suites: [], tests }]);

  let results: TestResults = {
    failures: [],
    passes: [],
    pending: [],
    stats: {
      suites: 0,
      tests: 0,
      passes: 0,
      pending: 0,
      failures: 0,
      start: undefined,
      end: undefined,
      duration: undefined,
    },
    tests: [],
  };

  try {
    results = await window.main.runTests(src);
    const testResult = await services.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackAnalyticsEvent({ event: AnalyticsEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test-result/:testResultId',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
          testResultId: testResult._id,
        },
      ),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // create a result manually so that it can be displayed in the UI
    results.stats.failures = 1;
    results.stats.tests = 1;
    results.tests.push({
      currentRetry: 0,
      duration: 0,
      err: {
        actual: undefined,
        expected: undefined,
        message: errorMessage,
        multiple: [],
        operator: undefined,
        showDiff: false,
        stack: '',
      },
      file: '',
      fullTitle: unitTest.name,
      id: '',
      title: unitTest.name,
    });
    const testResult = await services.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackAnalyticsEvent({ event: AnalyticsEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test-result/:testResultId',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
          testResultId: testResult._id,
        },
      ),
    );
  }
}

export const useTestRunActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
      testId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
      testId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test/:testId/run',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
          testId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
