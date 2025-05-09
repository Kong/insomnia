import React, { type FC } from 'react';
import { Heading } from 'react-aria-components';
import { type LoaderFunction, redirect, useRouteLoaderData } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import type { UnitTestResult } from '../../models/unit-test-result';
import { invariant } from '../../utils/invariant';
import { Icon } from '../components/icon';

interface TestResultsData {
  testResult: UnitTestResult;
}

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(testSuiteId, 'Test suite ID is required');

  const testResult = await models.unitTestResult.getLatestByParentId(workspaceId);
  if (testResult) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  }

  return null;
};

export const loader: LoaderFunction = async ({ params }): Promise<TestResultsData> => {
  const { testResultId } = params;
  invariant(testResultId, 'Test Result ID is required');
  const testResult = await database.getWhere<UnitTestResult>(models.unitTestResult.type, {
    _id: testResultId,
  });
  invariant(testResult, 'Test Result not found');
  return {
    testResult,
  };
};

export const TestRunStatus: FC = () => {
  const { testResult } = useRouteLoaderData(':testResultId') as TestResultsData;

  if (!testResult) {
    return null;
  }
  const { stats, tests } = testResult.results;

  return (
    <div key={testResult._id} className="flex h-full w-full flex-1 flex-col divide-y divide-solid divide-[--hl-md]">
      <Heading
        className={`flex h-[--line-height-sm] w-full flex-shrink-0 items-center gap-2 p-[--padding-md] text-lg ${
          stats.failures > 0 ? 'text-[--color-danger]' : 'text-[--color-success]'
        }`}
      >
        <Icon icon={stats.failures > 0 ? 'exclamation-triangle' : 'check-square'} />
        <span className="truncate">{stats.failures > 0 ? 'Tests failed' : 'Tests passed'} </span>
        {stats.failures > 0 ? stats.failures : stats.passes}/{stats.tests}
      </Heading>
      <div
        className="flex w-full flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto"
        aria-label="Test results"
      >
        {tests.map((test, i) => {
          const errorMessage = 'message' in test.err ? test.err.message : '';
          return (
            <div key={test.id || i} className="flex flex-col">
              <div className="flex items-center gap-2 p-[--padding-sm]">
                <div className="flex flex-shrink-0">
                  <span
                    className={`flex w-20 flex-shrink-0 rounded-sm border border-solid border-current ${
                      errorMessage ? 'text-[--color-danger]' : 'text-[--color-success]'
                    } items-center justify-center`}
                  >
                    {errorMessage ? 'Failed' : 'Passed'}
                  </span>
                </div>
                <div className="flex-1 truncate" title={test.title}>
                  {test.title}
                </div>
                <div className="flex flex-shrink-0">{test.duration} ms</div>
              </div>
              {errorMessage && (
                <div className="w-full px-[--padding-sm] pb-[--padding-sm]">
                  <code className="w-full">{errorMessage}</code>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
