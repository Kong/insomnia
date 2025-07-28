import { generate, runTests, type Test, type TestResults } from 'insomnia-testing';
import { type ActionFunctionArgs, redirect } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ params }: ActionFunctionArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');

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
    const testResult = await models.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  } catch (err) {
    // create a result manually so that it can be displayed in the UI
    results.stats.failures = 1;
    results.stats.tests = 1;
    results.tests.push({
      currentRetry: 0,
      duration: 0,
      err: {
        actual: undefined,
        expected: undefined,
        message: err.toString(),
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
    const testResult = await models.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  }
}
