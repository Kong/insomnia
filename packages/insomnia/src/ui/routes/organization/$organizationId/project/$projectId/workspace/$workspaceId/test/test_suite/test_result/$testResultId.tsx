import { database } from '@insomnia/common/database';
import * as models from '@insomnia/models';
import { UnitTestResult } from '@insomnia/models/unit-test-result';
import { ListGroup, UnitTestResultItem } from '@insomnia/ui/components/list-group';
import { invariant } from '@insomnia/utils/invariant';
import React, { FC } from 'react';
import { LoaderFunction, useRouteLoaderData } from 'react-router-dom';

interface TestResultsData {
  testResult: UnitTestResult;
}

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
