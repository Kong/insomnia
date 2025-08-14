import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { isRequestGroup } from '~/models/request-group';
import { isRequestGroupMeta } from '~/models/request-group-meta';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.toggle-expand-all';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const data = (await request.json()) as {
    toggle: 'collapse-all' | 'expand-all';
  };
  const isCollapsed = data.toggle === 'collapse-all';
  const descendants = await database.getWithDescendants(workspace, [
    models.requestGroup.type,
    models.requestGroupMeta.type,
  ]);

  const requestGroups = descendants.filter(isRequestGroup);
  const requestGroupMetas = descendants.filter(isRequestGroupMeta);
  await Promise.all(
    requestGroups.map(requestGroup => {
      const requestGroupMeta = requestGroupMetas.find(meta => meta.parentId === requestGroup._id);

      if (requestGroupMeta) {
        return models.requestGroupMeta.update(requestGroupMeta, { collapsed: isCollapsed });
      }
      return models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: isCollapsed });
    }),
  );
  return null;
}

export function useToggleExpandAllActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      toggle,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      toggle: 'collapse-all' | 'expand-all';
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/toggle-expand-all', {
        organizationId,
        projectId,
        workspaceId,
      });

      return fetcherSubmit(JSON.stringify({ toggle }), {
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
