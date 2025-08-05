import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { getById, update } from '~/models/helpers/request-operations';
import { isRequestGroup, isRequestGroupId } from '~/models/request-group';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';

const getCollectionItem = async (id: string) => {
  let item;
  if (isRequestGroupId(id)) {
    item = await models.requestGroup.getById(id);
  } else {
    item = await getById(id);
  }

  invariant(item, 'Item not found');

  return item;
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { id, targetId, dropPosition, metaSortKey } = await request.json();
  invariant(typeof id === 'string', 'ID is required');
  invariant(typeof targetId === 'string', 'Target ID is required');
  invariant(typeof dropPosition === 'string', 'Drop position is required');
  invariant(typeof metaSortKey === 'number', 'MetaSortKey position is required');

  if (id === targetId) {
    return null;
  }

  const item = await getCollectionItem(id);
  const targetItem = await getCollectionItem(targetId);

  const parentId = dropPosition === 'after' && isRequestGroup(targetItem) ? targetItem._id : targetItem.parentId;

  if (isRequestGroup(item)) {
    await models.requestGroup.update(item, { parentId, metaSortKey });
  } else {
    await update(item, { parentId, metaSortKey });
  }

  return null;
}

export function useDebugReorderActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      params: {
        id: string;
        targetId: string;
        dropPosition: string;
        metaSortKey: number;
      };
    }) => {
      return fetcherSubmit(JSON.stringify(params), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/reorder`, {
          organizationId,
          projectId,
          workspaceId,
        }),
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
