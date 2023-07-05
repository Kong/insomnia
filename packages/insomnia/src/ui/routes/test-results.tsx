import React, { FC } from 'react';
import { LoaderFunction, redirect, useRouteLoaderData } from 'react-router-dom';

import { database } from '../../common/database';
import * as models from '../../models';
import { UnitTestResult } from '../../models/unit-test-result';
import { invariant } from '../../utils/invariant';
import { ListGroup, UnitTestResultItem } from '../components/list-group';

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
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`);
  }

  return null;
};

export const loader: LoaderFunction = async ({
  params,
}): Promise<TestResultsData> => {
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

  const { stats, tests } = testResult.results;
  return (
    <div className="unit-tests__results">
      {testResult && (
        <div key={testResult._id}>
          <div className="unit-tests__top-header">
            {stats.failures ? (
              <h2 className="warning">
                Tests Failed {stats.failures}/{stats.tests}
              </h2>
            ) : (
              <h2 className="success">
                Tests Passed {stats.passes}/{stats.tests}
              </h2>
            )}
          </div>
          <ListGroup>
            {tests.map((t: any, i: number) => (
              <UnitTestResultItem key={i} item={t} />
            ))}
          </ListGroup>
        </div>
      )}
    </div>
  );
};
