import { redirect } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { projectId, workspaceId, organizationId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  invariant(projectId, 'Project ID is required');
  const activeWorkspace = await models.workspace.getById(workspaceId);
  invariant(activeWorkspace, 'Workspace not found');
  // Mcp collection only have one request
  const activeRequest = await models.mcpRequest.getByParentId(workspaceId);
  invariant(activeRequest, 'MCP Request not found');
  // Redirect to the debug page of the only request in the MCP workspace
  if (activeRequest) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequest._id}`,
    );
  }
  return null;
}
