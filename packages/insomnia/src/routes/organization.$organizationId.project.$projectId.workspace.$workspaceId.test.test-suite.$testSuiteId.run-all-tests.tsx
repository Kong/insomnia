import { generate, runTests, type Test, type TestResults } from 'insomnia-testing';
import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import type { UnitTest } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { getSendRequestCallback } from '~/network/unit-test-feature';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.run-all-tests';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;

  const unitTests = await database.find<UnitTest>(models.unitTest.type, { parentId: testSuiteId }, { metaSortKey: 1 });
  invariant(unitTests, 'No unit tests found');

  const tests: Test[] = unitTests
    .filter(t => t !== null)
    .map(t => ({
      name: t.name,
      code: t.code,
      defaultRequestId: t.requestId,
    }));

  const src = generate([{ name: 'My Suite', suites: [], tests }]);

  const sendRequest = getSendRequestCallback();

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
    results = await runTests(src, { sendRequest });
    const testResult = await services.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.toString() : 'Unknown error occurred';

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
      fullTitle: 'Test Error',
      id: '',
      title: 'Test Error',
    });
    const testResult = await services.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

    return redirect(
      href(
        `/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test-result/:testResultId`,
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

export const useRunAllTestsActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/run-all-tests',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
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
