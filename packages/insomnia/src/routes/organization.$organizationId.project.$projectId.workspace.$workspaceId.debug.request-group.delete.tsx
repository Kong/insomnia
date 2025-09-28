import { href } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const id = formData.get('id') as string;

  const requestGroup = await models.requestGroup.getById(id);
  invariant(requestGroup, 'Request Group not found');

  models.stats.incrementDeletedRequestsForDescendents(requestGroup);

  await models.requestGroup.remove(requestGroup);

  return null;
}

export const useRequestGroupDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      id,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      id: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/delete',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      const formData = new FormData();
      formData.set('id', id);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
