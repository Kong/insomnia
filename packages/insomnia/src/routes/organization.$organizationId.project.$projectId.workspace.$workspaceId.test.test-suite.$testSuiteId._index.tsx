import type { UnitTestResult } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { database } from '~/common/database';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;

  const testResult = await database.findOne<UnitTestResult>(
    'UnitTestResult',
    {
      parentId: workspaceId,
    },
    { modified: -1 },
  );
  if (testResult) {
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

  return null;
}
