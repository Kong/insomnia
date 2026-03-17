import { href } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import type { GrpcRequest } from '~/models/grpc-request';
import * as requestOperations from '~/models/helpers/request-operations';
import type { Request } from '~/models/request';
import { isRequestGroup, type RequestGroup } from '~/models/request-group';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { WebSocketRequest } from '~/models/websocket-request';
import { isCollection } from '~/models/workspace';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.sidebar-tree.move';

type CollectionNodeType = 'request' | 'request-group';
type DropTargetType = 'workspace' | 'request' | 'request-group';
type DropPosition = 'before' | 'after' | 'inside';

type CollectionNode = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;

interface MoveCollectionNodeParams {
  sourceId: string;
  sourceType: CollectionNodeType;
  targetId: string;
  targetType: DropTargetType;
  dropPosition: DropPosition;
}

async function getCollectionNode(type: CollectionNodeType, id: string): Promise<CollectionNode> {
  if (type === 'request-group') {
    const requestGroup = await models.requestGroup.getById(id);
    invariant(requestGroup, 'Request group not found');
    return requestGroup;
  }

  const request =
    (await models.request.getById(id)) ||
    (await models.grpcRequest.getById(id)) ||
    (await models.webSocketRequest.getById(id)) ||
    (await models.socketIORequest.getById(id));

  invariant(request, 'Request not found');
  return request;
}

async function getRequestLikeByParentId(parentId: string) {
  const [httpRequests, grpcRequests, webSocketRequests, socketIoRequests, requestGroups] =
    await Promise.all([
      database.find<Request>(models.request.type, { parentId }),
      database.find<GrpcRequest>(models.grpcRequest.type, { parentId }),
      database.find<WebSocketRequest>(models.webSocketRequest.type, { parentId }),
      database.find<SocketIORequest>(models.socketIORequest.type, { parentId }),
      database.find<RequestGroup>(models.requestGroup.type, { parentId }),
    ]);

  return [
    ...httpRequests,
    ...grpcRequests,
    ...webSocketRequests,
    ...socketIoRequests,
    ...requestGroups,
  ]
    .filter(item => typeof item.metaSortKey === 'number')
    .sort((a, b) => a.metaSortKey - b.metaSortKey);
}

function getMetaSortKeyForAppendToEnd(siblings: CollectionNode[]) {
  const last = siblings.at(-1);

  if (last && typeof last.metaSortKey === 'number') {
    return last.metaSortKey + 100;
  }

  return -1 * Date.now();
}

function getMetaSortKeyForReorder({
  siblings,
  targetId,
  dropPosition,
}: {
  siblings: CollectionNode[];
  targetId: string;
  dropPosition: Exclude<DropPosition, 'inside'>;
}) {
  const targetIndex = siblings.findIndex(item => item._id === targetId);
  invariant(targetIndex !== -1, 'Target item not found among siblings');

  if (dropPosition === 'before') {
    const beforeItem = siblings[targetIndex - 1];
    const afterItem = siblings[targetIndex];

    return beforeItem && afterItem
      ? afterItem.metaSortKey - (afterItem.metaSortKey - beforeItem.metaSortKey) / 2
      : afterItem.metaSortKey - 100;
  }

  const beforeItem = siblings[targetIndex];
  const afterItem = siblings[targetIndex + 1];

  return beforeItem && afterItem
    ? beforeItem.metaSortKey - (beforeItem.metaSortKey - afterItem.metaSortKey) / 2
    : beforeItem.metaSortKey + 100;
}

async function isDescendantRequestGroup({
  requestGroupId,
  possibleAncestorId,
}: {
  requestGroupId: string;
  possibleAncestorId: string;
}) {
  let current = await models.requestGroup.getById(requestGroupId);

  while (current && isRequestGroup(current) && models.requestGroup.isRequestGroupId(current.parentId)) {
    if (current.parentId === possibleAncestorId) {
      return true;
    }

    current = await models.requestGroup.getById(current.parentId);
  }

  return false;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const params = (await request.json()) as MoveCollectionNodeParams;
  const { sourceId, sourceType, targetId, targetType, dropPosition } = params;

  invariant(typeof sourceId === 'string', 'Source ID is required');
  invariant(sourceType === 'request' || sourceType === 'request-group', 'Invalid source type');
  invariant(typeof targetId === 'string', 'Target ID is required');
  invariant(targetType === 'workspace' || targetType === 'request' || targetType === 'request-group', 'Invalid target type');
  invariant(dropPosition === 'before' || dropPosition === 'after' || dropPosition === 'inside', 'Invalid drop position');

  const source = await getCollectionNode(sourceType, sourceId);

  let parentId = '';
  let metaSortKey = 0;

  if (targetType === 'workspace') {
    invariant(dropPosition === 'inside', 'Can only drop inside workspace root');

    const workspace = await models.workspace.getById(targetId);
    invariant(workspace, 'Target workspace not found');
    invariant(isCollection(workspace), 'Target workspace must be a collection');

    parentId = workspace._id;

    const siblings = await getRequestLikeByParentId(parentId);
    metaSortKey = getMetaSortKeyForAppendToEnd(siblings);
  }

  if (targetType === 'request-group') {
    const targetRequestGroup = await models.requestGroup.getById(targetId);
    invariant(targetRequestGroup, 'Target request group not found');

    if (sourceType === 'request-group' && dropPosition === 'inside') {
      const sourceIsAncestor = await isDescendantRequestGroup({
        requestGroupId: targetRequestGroup._id,
        possibleAncestorId: sourceId,
      });
      invariant(!sourceIsAncestor, 'Cannot move a folder into its descendant');
    }

    parentId = dropPosition === 'inside' ? targetRequestGroup._id : targetRequestGroup.parentId;

    if (dropPosition === 'inside') {
      const siblings = await getRequestLikeByParentId(parentId);
      metaSortKey = getMetaSortKeyForAppendToEnd(siblings);
    } else {
      const siblings = await getRequestLikeByParentId(parentId);
      metaSortKey = getMetaSortKeyForReorder({ siblings, targetId, dropPosition });
    }
  }

  if (targetType === 'request') {
    invariant(dropPosition !== 'inside', 'Cannot drop inside request');

    const targetRequest = await getCollectionNode('request', targetId);
    parentId = targetRequest.parentId;

    const siblings = await getRequestLikeByParentId(parentId);
    metaSortKey = getMetaSortKeyForReorder({ siblings, targetId, dropPosition });
  }

  invariant(parentId, 'Parent ID is required');
  invariant(Number.isFinite(metaSortKey), 'Meta sort key is invalid');

  if (isRequestGroup(source)) {
    await models.requestGroup.update(source, { parentId, metaSortKey });
  } else {
    await requestOperations.update(source, { parentId, metaSortKey });
  }

  return null;
}

export const useProjectSidebarTreeMoveActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      params,
    }: {
      organizationId: string;
      projectId: string;
      params: MoveCollectionNodeParams;
    }) => {
      return submit(JSON.stringify(params), {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/sidebar-tree/move', {
          organizationId,
          projectId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
