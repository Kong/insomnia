import { href, redirect } from 'react-router';

import * as models from '~/models';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { projectId, workspaceId, organizationId } = params;

  const project = await models.project.getById(projectId);
  if (!project) {
    showResourceNotFoundToast(`Project not found: ${projectId}`);
    throw redirect(href('/organization/:organizationId/project', { organizationId }));
  }

  const activeWorkspace = await models.workspace.getById(workspaceId);
  if (!activeWorkspace) {
    showResourceNotFoundToast(`MCP Client not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }
  // MCP collection only have one request
  const activeRequest = await models.mcpRequest.getByParentId(workspaceId);
  if (!activeRequest) {
    showResourceNotFoundToast(`MCP Request not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }
  // Redirect to the debug page of the only request in the MCP workspace
  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId', {
      organizationId,
      projectId,
      workspaceId,
      requestId: activeRequest._id,
    }),
  );
}
