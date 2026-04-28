import { href } from 'react-router';

import { services } from '~/insomnia-data';
import * as requestOperations from '~/models/helpers/request-operations';
import { removeResponsesForRequest } from '~/models/helpers/response-operations';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { workspaceId, requestId } = params;

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Active workspace meta not found');

  await removeResponsesForRequest(requestId, workspaceMeta.activeEnvironmentId);

  return null;
}

export const useRequestResponseDeleteAllActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId/response/delete-all',
        {
          organizationId,
          projectId,
          workspaceId,
          requestId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
