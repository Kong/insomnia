import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const req = await requestOperations.getById(id);
  invariant(req, 'Request not found');
  models.stats.incrementDeletedRequests();
  await requestOperations.remove(req);
  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');
  if (workspaceMeta.activeRequestId === id) {
    await models.workspaceMeta.updateByParentId(workspaceId, { activeRequestId: null });
    if (request.url.includes(id)) {
      return redirect(
        href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
          organizationId,
          projectId,
          workspaceId,
        }),
      );
    }
  }
  return null;
}

export function useRequestDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
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
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/delete', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.append('id', id);

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
