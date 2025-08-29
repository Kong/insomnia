import { href, Outlet, redirect } from 'react-router';

import * as models from '~/models';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test._index';

export default Outlet;

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeUnitTestSuiteId) {
    const unitTestSuite = await models.unitTestSuite.getById(workspaceMeta.activeUnitTestSuiteId);

    if (unitTestSuite) {
      return redirect(
        href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId', {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId: unitTestSuite._id,
        }),
      );
    }
  }

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  if (unitTestSuites.length > 0) {
    return redirect(
      href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId', {
        organizationId,
        projectId,
        workspaceId,
        testSuiteId: unitTestSuites[0]._id,
      }),
    );
  }

  return null;
}
