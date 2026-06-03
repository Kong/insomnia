import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';

const { isRequestGroup, isRequestGroupId } = models.requestGroup;

const getCollectionItem = async (id: string) => {
  const item = await (isRequestGroupId(id) ? services.requestGroup.getById(id) : services.helpers.getRequestById(id));

  invariant(item, 'Item not found');

  return item;
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { id, targetId, dropPosition, metaSortKey } = await request.json();
  invariant(typeof id === 'string', 'ID is required');
  invariant(typeof targetId === 'string', 'Target ID is required');

  if (id === targetId) {
    return null;
  }
  if (models.workspace.isWorkspaceId(id)) {
    const item = await services.workspace.getById(id);
    const targetItem = await services.project.get(targetId);
    invariant(item, 'Drag item not found');
    invariant(targetItem, 'Target item not found');
    await services.workspace.update(item, {
      parentId: targetItem._id,
    });
    return null;
  }

  invariant(typeof metaSortKey === 'number', 'MetaSortKey position is required');
  if (models.workspace.isWorkspaceId(targetId)) {
    const targetItem = await services.workspace.getById(targetId);
    const item = await getCollectionItem(id);
    invariant(item, 'Drag item not found');
    invariant(targetItem, 'Target item not found');
    const parentId = targetItem._id;
    await (isRequestGroup(item)
      ? services.requestGroup.update(item, { parentId, metaSortKey })
      : services.helpers.updateRequest(item, { parentId, metaSortKey }));
    return null;
  }

  invariant(typeof dropPosition === 'string', 'Drop position is required');

  const item = await getCollectionItem(id);
  const targetItem = await getCollectionItem(targetId);

  const parentId = dropPosition === 'after' && isRequestGroup(targetItem) ? targetItem._id : targetItem.parentId;

  await (isRequestGroup(item)
    ? services.requestGroup.update(item, { parentId, metaSortKey })
    : services.helpers.updateRequest(item, { parentId, metaSortKey }));

  return null;
}

export const useDebugReorderActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      params:
        | {
            id: string;
            targetId: string;
            dropPosition: string;
            metaSortKey: number;
          }
        | {
            type: 'move-workspace';
            id: string;
            targetId: string;
          };
    }) => {
      return submit(JSON.stringify(params), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/reorder`, {
          organizationId,
          projectId,
          workspaceId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
