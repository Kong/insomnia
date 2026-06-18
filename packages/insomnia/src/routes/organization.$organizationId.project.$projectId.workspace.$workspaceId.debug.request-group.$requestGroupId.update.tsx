import type { RequestGroup } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update-meta';

export async function clientAction({ request, params }: Route.ActionArgs) {
  const { requestGroupId } = params;

  const reqGroup = await services.requestGroup.getById(requestGroupId);
  invariant(reqGroup, 'Request Group not found');

  const patch = (await request.json()) as Partial<RequestGroup>;

  await services.requestGroup.update(reqGroup, patch);

  return null;
}

export const useRequestGroupUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      requestGroupId,
      patch,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      requestGroupId: string;
      patch: Partial<RequestGroup>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId/update',
        {
          organizationId,
          projectId,
          workspaceId,
          requestGroupId,
        },
      );

      return submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
