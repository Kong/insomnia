import type { QueryClient } from '@tanstack/react-query';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  BaseModel,
  CollectionWorkspaceChildren,
  WorkspaceChildren,
  WorkspaceChildrenForScope,
  WorkspaceScope,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { useCallback } from 'react';

export const findWorkspaceIdForDoc = (queryClient: QueryClient, doc: BaseModel) => {
  let docWorkspaceId: string | undefined;
  const cachedWorkspaces = queryClient.getQueriesData<WorkspaceChildren>({
    queryKey: workspaceChildrenKeys.all,
  });
  for (const [queryKey, data] of cachedWorkspaces) {
    const workspaceId = queryKey[1] as string;
    if (!data || !data.children || !('requestsAndGroups' in data.children)) {
      continue;
    }
    if (
      doc.parentId === workspaceId ||
      data.children.requestsAndGroups.some(r => r._id === doc._id || r._id === doc.parentId)
    ) {
      return workspaceId;
    }
  }
  return docWorkspaceId;
};

export function updateCollectionChildrenWithUpdatedDoc(
  collectionChildren: CollectionWorkspaceChildren,
  doc: BaseModel,
): CollectionWorkspaceChildren | null {
  // ALL request doc types
  const REQUEST_DOC_TYPES: string[] = [
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
    models.requestGroup.type,
  ];
  // All request meta doc types
  const REQUEST_META_DOC_TYPES: string[] = [
    models.requestMeta.type,
    models.grpcRequestMeta.type,
    models.webSocketRequestMeta.type,
    models.socketIORequestMeta.type,
  ];

  const replaceById = <T extends BaseModel>(list: T[]): T[] | null => {
    const index = list.findIndex(item => item._id === doc._id);
    if (index === -1) {
      return null;
    }
    // The item has been moved to another parent, consider failure to update
    if (list[index].parentId !== doc.parentId) {
      return null;
    }
    const next = list.slice();
    next[index] = doc as unknown as T;
    return next;
  };

  if (REQUEST_DOC_TYPES.includes(doc.type)) {
    const requestsAndGroups = replaceById(collectionChildren.children.requestsAndGroups);
    return requestsAndGroups
      ? {
          ...collectionChildren,
          children: {
            requestsAndGroups,
          },
        }
      : null;
  }
  if (REQUEST_META_DOC_TYPES.includes(doc.type)) {
    const allRequestMetas = replaceById(collectionChildren.childrenMetas.allRequestMetas);
    return allRequestMetas
      ? { ...collectionChildren, childrenMetas: { ...collectionChildren.childrenMetas, allRequestMetas } }
      : null;
  }
  if (doc.type === models.requestGroupMeta.type) {
    const requestGroupMetas = replaceById(collectionChildren.childrenMetas.requestGroupMetas);
    return requestGroupMetas
      ? { ...collectionChildren, childrenMetas: { ...collectionChildren.childrenMetas, requestGroupMetas } }
      : null;
  }
  return null;
}

export const workspaceChildrenKeys = {
  all: ['workspaceChildrenAndMetas'],
  byWorkspaceId: (workspaceId: string) => [...workspaceChildrenKeys.all, workspaceId],
};

const pendingBatches = new Map<string, { ids: string[]; batch: Promise<Map<string, WorkspaceChildren>> }>();

//Combine all per-workspace reads of the same scope requested within the same microtask into a single batched DB sweep
const loadWorkspaceChildrenBatched = (workspaceId: string, scope?: WorkspaceScope): Promise<WorkspaceChildren> => {
  const scopeKey = scope || '__all__';
  let pending = pendingBatches.get(scopeKey);
  if (!pending) {
    const ids: string[] = [];
    const batch = Promise.resolve().then(() => {
      pendingBatches.delete(scopeKey);
      console.log(`Batching requests/meta load for workspaces (${scopeKey}): ${ids.join(', ')}`);
      return services.appData.getWorkspaceChildren(ids, scope);
    });
    pending = { ids, batch };
    pendingBatches.set(scopeKey, pending);
  }
  if (!pending.ids.includes(workspaceId)) {
    pending.ids.push(workspaceId);
  }
  return pending.batch.then(map => map.get(workspaceId)!);
};

export const useWorkspaceChildren = (workspaceId: string, scope?: WorkspaceScope) => {
  const { data: workspaceChildren } = useQuery({
    queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
    queryFn: () => loadWorkspaceChildrenBatched(workspaceId, scope),
  });
  return workspaceChildren;
};

export const useWorkspaceChildrenByWorkspaceIds = <S extends WorkspaceScope | undefined = undefined>(
  workspaceIds: string[],
  scope?: S,
) =>
  useQueries({
    queries: workspaceIds.map(workspaceId => ({
      queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
      queryFn: (): Promise<WorkspaceChildrenForScope<S>> =>
        loadWorkspaceChildrenBatched(workspaceId, scope) as Promise<WorkspaceChildrenForScope<S>>,
    })),
    combine: useCallback(
      (results: UseQueryResult<WorkspaceChildrenForScope<S>>[]) => {
        const dataByWorkspaceId = new Map<string, WorkspaceChildrenForScope<S>>();
        workspaceIds.forEach((workspaceId, index) => {
          const data = results[index]?.data;
          if (data) {
            dataByWorkspaceId.set(workspaceId, data);
          }
        });
        return dataByWorkspaceId;
      },
      [workspaceIds],
    ),
  });
