import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

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
    models.request.type,
    models.requestMeta.type,
  ]);

  const requestGroups = descendants.filter(isRequestGroup);
  const requestGroupMetas = descendants.filter(isRequestGroupMeta);
  // Examples are a request's sidebar children, so their section follows the same
  // expand/collapse-all command. Only a request with examples (or an existing
  // meta) needs the flag: it is the sole reader. Writing a meta for every request
  // would add a row and a change event per request that nothing consumes.
  const requests = descendants.filter(models.request.isRequest);
  const requestMetas = descendants.filter(models.requestMeta.isRequestMeta);
  const exampleParentIds = new Set(
    (
      await database.find(
        models.example.type,
        { parentId: { $in: requests.map(request => request._id) } },
        undefined,
        undefined,
        // Ids only: example bodies run to 1 MB each.
        { _id: 1, parentId: 1 },
      )
    ).map(example => example.parentId),
  );
  const requestsWithExamples = requests.filter(
    request => exampleParentIds.has(request._id) || requestMetas.some(meta => meta.parentId === request._id),
  );
  // One flush for the whole batch: each write otherwise fires a change event,
  // and a UI revalidation per request.
  const bufferId = await database.bufferChanges();
  try {
    await Promise.all([
      ...requestGroups.map(requestGroup => {
        const requestGroupMeta = requestGroupMetas.find(meta => meta.parentId === requestGroup._id);

        if (requestGroupMeta) {
          return services.requestGroupMeta.update(requestGroupMeta, { collapsed: isCollapsed });
        }
        return services.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: isCollapsed });
      }),
      ...requestsWithExamples.map(request =>
        services.requestMeta.updateOrCreateByParentId(request._id, { collapsed: isCollapsed }),
      ),
    ]);
  } finally {
    await database.flushChanges(bufferId);
  }
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
