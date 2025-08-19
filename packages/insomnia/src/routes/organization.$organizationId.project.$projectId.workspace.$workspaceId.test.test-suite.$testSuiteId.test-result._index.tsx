import { href, redirect } from 'react-router';

import * as models from '~/models';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test-result._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;

  const testResult = await models.unitTestResult.getLatestByParentId(workspaceId);
  if (testResult) {
    return redirect(
      href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test-result/:testResultId',
        { organizationId, projectId, workspaceId, testSuiteId, testResultId: testResult._id },
      ),
    );
  }

  return null;
}
