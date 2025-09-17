import { href } from 'react-router';

import * as requestOperations from '~/models/helpers/request-operations';
import type { McpRequest } from '~/models/mcp-request';
import * as projectModel from '~/models/project';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.grant-access';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId, projectId } = params;

  const req = (await requestOperations.getById(requestId)) as McpRequest;
  invariant(req, 'Request not found');
  const { grantLevel } = await request.json();

  if (grantLevel === 'request') {
    await requestOperations.update(req, { mcpStdioAccess: true });
    return;
  }

  const project = await projectModel.getById(projectId);
  invariant(project, 'Project not found for request');
  if (grantLevel === 'project') {
    await projectModel.update(project, { mcpStdioAccess: true });
  }
}

export const useRequestGrantAccessFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      grantLevel,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      grantLevel: 'request' | 'project';
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/grant-access',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(JSON.stringify({ grantLevel }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
