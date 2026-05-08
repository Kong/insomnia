import { href } from 'react-router';

import type { McpRequest } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.grant-access';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { requestId, projectId } = params;

  const req = (await services.helpers.getRequestById(requestId)) as McpRequest;
  invariant(req, 'Request not found');
  const { accessLevel } = await request.json();

  if (accessLevel === 'request') {
    await services.helpers.updateRequest(req, { mcpStdioAccess: true });
    return;
  }

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found for request');
  if (accessLevel === 'project') {
    await services.project.update(project, { mcpStdioAccess: true });
  }
}

export const useRequestGrantAccessFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
      accessLevel,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
      accessLevel: 'request' | 'project';
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

      return submit(JSON.stringify({ accessLevel }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
