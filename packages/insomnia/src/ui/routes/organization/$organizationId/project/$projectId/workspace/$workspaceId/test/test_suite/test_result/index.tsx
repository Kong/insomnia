import * as models from '@insomnia/models';
import { invariant } from '@remix-run/router';
import { LoaderFunction, redirect } from 'react-router-dom';

export const loader: LoaderFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(testSuiteId, 'Test suite ID is required');

  const testResult = await models.unitTestResult.getLatestByParentId(workspaceId);
  if (testResult) {
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`);
  }

  return;
};
