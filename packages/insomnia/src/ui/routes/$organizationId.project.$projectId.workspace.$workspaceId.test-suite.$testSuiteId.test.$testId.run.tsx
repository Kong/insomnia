import { generate, runTests, type Test, type TestResults } from 'insomnia-testing';
import { type ActionFunctionArgs, redirect } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ params }: ActionFunctionArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId, testId } = params;
  invariant(typeof testId === 'string', 'Test ID is required');

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
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
    const testResult = await models.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  } catch (error) {
    // create a result manually so that it can be displayed in the UI
    results.stats.failures = 1;
    results.stats.tests = 1;
    results.tests.push({
      currentRetry: 0,
      duration: 0,
      err: {
        actual: undefined,
        expected: undefined,
        message: error.toString(),
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
    const testResult = await models.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  }
}
