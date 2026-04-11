import { href } from 'react-router';

import { database } from '~/common/database';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.toggle-expand-all';

const { isRequestGroup } = models.requestGroup;
const { isRequestGroupMeta } = models.requestGroupMeta;

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const workspace = await services.workspace.getById(workspaceId);
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
        return services.requestGroupMeta.update(requestGroupMeta, { collapsed: isCollapsed });
      }
      return services.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: isCollapsed });
    }),
  );
  return null;
}

export const useToggleExpandAllActionFetcher = createFetcherSubmitHook(
  submit =>
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

      return submit(JSON.stringify({ toggle }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
