import type { RequestGroupMeta } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const patch = (await request.json()) as Partial<RequestGroupMeta>;
  const requestGroupMeta = await services.requestGroupMeta.getByParentId(requestGroupId);
  if (requestGroupMeta) {
    await services.requestGroupMeta.update(requestGroupMeta, patch);
    return null;
  }
  await services.requestGroupMeta.create({ parentId: requestGroupId, collapsed: Boolean(patch?.collapsed) });
  return null;
}

export const useRequestGroupUpdateMetaActionFetcher = createFetcherSubmitHook(
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
      patch: Partial<RequestGroupMeta>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId/update-meta',
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
