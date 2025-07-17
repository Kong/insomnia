import { type ActionFunctionArgs, redirect } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const patch = await request.json();
  invariant(typeof patch.name === 'string', 'Name is required');
  // TODO: remove this hack which enables a mock server to be created alongside a route
  // TODO: use an alternate method to create new workspace and server together
  // create a mock server under the workspace with the same name
  if (patch.mockServerName) {
    const collectionWorkspace = await models.workspace.getById(workspaceId);
    invariant(collectionWorkspace, 'Collection workspace not found');
    const mockWorkspace = await models.workspace.create({
      name: collectionWorkspace.name,
      scope: 'mock-server',
      parentId: projectId,
    });
    invariant(mockWorkspace, 'Workspace not found');
    const newMockServer = await models.mockServer.getOrCreateForParentId(mockWorkspace._id, {
      name: collectionWorkspace.name,
    });
    delete patch.mockServerName;
    const mockRoute = await models.mockRoute.create({ ...patch, parentId: newMockServer._id });
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${newMockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
    );
  }
  const mockServer = await models.mockServer.getById(patch.parentId);
  invariant(mockServer, 'Mock server not found');
  const mockRoute = await models.mockRoute.create(patch);
  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${mockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
  );
}
