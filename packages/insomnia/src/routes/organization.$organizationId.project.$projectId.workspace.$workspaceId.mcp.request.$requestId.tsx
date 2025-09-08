import { Outlet, useRouteLoaderData } from 'react-router';

import type { BaseModel } from '~/models';
import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.request.$requestId';
export default Outlet;

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, requestId, workspaceId } = params;

  const activeRequest = await requestOperations.getById(requestId);
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  invariant(activeRequestMeta, 'Request meta not found');
  const { filterResponsesByEnv } = await models.settings.get();

  const activeResponse = activeRequestMeta.activeResponseId
    ? await models.mcpResponse.getById(activeRequestMeta.activeResponseId)
    : await models.mcpResponse.getLatestForRequestId(requestId, activeWorkspaceMeta.activeEnvironmentId);
  const allResponses = await models.mcpResponse.findByParentId(requestId);
  const filteredResponses = allResponses.filter(r => r.environmentId === activeWorkspaceMeta.activeEnvironmentId);
  const responses = (filterResponsesByEnv ? filteredResponses : allResponses).sort((a: BaseModel, b: BaseModel) =>
    a.created > b.created ? -1 : 1,
  );

  return {
    activeRequest,
    activeRequestMeta,
    activeResponse,
    responses,
    requestVersions: await models.requestVersion.findByParentId(requestId),
  };
}

export function useMcpRequestLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.request.$requestId',
  );
}
