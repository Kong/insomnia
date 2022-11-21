import * as models from '@insomnia/models';
import { invariant } from '@remix-run/router';
import { LoaderFunction, redirect } from 'react-router-dom';

export const loader: LoaderFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'organizationId is required');
  invariant(projectId, 'projectId is required');
  invariant(workspaceId, 'workspaceId is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeUnitTestSuiteId) {
    const unitTestSuite = await models.unitTestSuite.getById(workspaceMeta.activeUnitTestSuiteId);

    if (unitTestSuite) {
      return redirect(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`
      );
    }
  }

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  if (unitTestSuites.length > 0) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuites[0]._id}`
    );
  }
  return;
};
