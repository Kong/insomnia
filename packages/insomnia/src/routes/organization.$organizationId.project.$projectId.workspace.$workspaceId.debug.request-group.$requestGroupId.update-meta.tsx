import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import type { RequestGroupMeta } from '~/models/request-group-meta';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const patch = (await request.json()) as Partial<RequestGroupMeta>;
  const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
  if (requestGroupMeta) {
    await models.requestGroupMeta.update(requestGroupMeta, patch);
    return null;
  }
  await models.requestGroupMeta.create({ parentId: requestGroupId, collapsed: Boolean(patch?.collapsed) });
  return null;
}

export function useRequestGroupUpdateMetaActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
