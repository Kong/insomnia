import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

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

export function useRequestGroupDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(formData, {
        action: url,
        method: 'POST',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
