import type { QueryClient } from '@tanstack/react-query';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  BaseModel,
  CollectionWorkspaceChildren,
  DesignWorkspaceChildren,
  EnvironmentWorkspaceChildren,
  McpWorkspaceChildren,
  MockServerWorkspaceChildren,
  Workspace,
  WorkspaceChildren,
  WorkspaceScope,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { useCallback } from 'react';

import { database } from '~/common/database';

interface ScopeToChildren {
  'collection': CollectionWorkspaceChildren;
  'design': DesignWorkspaceChildren;
  'mock-server': MockServerWorkspaceChildren;
  'environment': EnvironmentWorkspaceChildren;
  'mcp': McpWorkspaceChildren;
}

type WorkspaceChildrenForScope<S extends WorkspaceScope | undefined> = S extends WorkspaceScope
  ? ScopeToChildren[S]
  : WorkspaceChildren;

export const workspaceChildrenKeys = {
  all: ['workspaceChildrenAndMetas'],
  byWorkspaceId: (workspaceId: string) => [...workspaceChildrenKeys.all, workspaceId],
};

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

const getWorkspaceChildren = async <S extends WorkspaceScope | undefined = undefined>(
  workspaceIds: string[],
  scope?: S,
): Promise<Map<string, WorkspaceChildrenForScope<S>>> => {
  if (scope) {
    switch (scope) {
      case 'design': {
        const designChildrenByWorkspaceIds = await services.appData.getAllDesignChildrenByWorkspaceIds(workspaceIds);
        return designChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'collection': {
        const collectionChildrenByWorkspaceIds =
          await services.appData.getAllCollectionChildrenAndMetasByWorkspaceIds(workspaceIds);
        return collectionChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'mock-server': {
        const mockServerChildrenByWorkspaceIds =
          await services.appData.getAllMockServerChildrenByWorkspaceIds(workspaceIds);
        return mockServerChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'environment': {
        const environmentChildrenByWorkspaceIds =
          await services.appData.getAllEnvironmentChildrenByWorkspaceIds(workspaceIds);
        return environmentChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'mcp': {
        const mcpChildrenByWorkspaceIds = await services.appData.getAllMcpChildrenByWorkspaceIds(workspaceIds);
        return mcpChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      default: {
        console.warn(`Unsupported workspace scope: ${scope}`);
        return new Map();
      }
    }
  }
  const workspaces = await database.find<Workspace>(models.workspace.type, {
    _id: { $in: workspaceIds },
  });
  if (workspaces.length > 0) {
    const workspaceIdToScopeMap = new Map(workspaces.map(workspace => [workspace._id, workspace.scope]));
    const collectionWorkspaceIds = workspaces.filter(w => w.scope === 'collection').map(w => w._id);
    const mockServerWorkspaceIds = workspaces.filter(w => w.scope === 'mock-server').map(w => w._id);
    const designWorkspaceIds = workspaces.filter(w => w.scope === 'design').map(w => w._id);
    const environmentWorkspaceIds = workspaces.filter(w => w.scope === 'environment').map(w => w._id);
    const mcpWorkspaceIds = workspaces.filter(w => w.scope === 'mcp').map(w => w._id);
    const collectionChildrenPromise =
      services.appData.getAllCollectionChildrenAndMetasByWorkspaceIds(collectionWorkspaceIds);
    const mockServerChildrenPromise = services.appData.getAllMockServerChildrenByWorkspaceIds(mockServerWorkspaceIds);
    const designChildrenPromise = services.appData.getAllDesignChildrenByWorkspaceIds(designWorkspaceIds);
    const environmentChildrenPromise =
      services.appData.getAllEnvironmentChildrenByWorkspaceIds(environmentWorkspaceIds);
    const mcpChildrenPromise = services.appData.getAllMcpChildrenByWorkspaceIds(mcpWorkspaceIds);
    const [
      collectionChildrenByWorkspaceIds,
      mockServerChildrenByWorkspaceIds,
      designChildrenByWorkspaceIds,
      environmentChildrenByWorkspaceIds,
      mcpChildrenByWorkspaceIds,
    ] = await Promise.all([
      collectionChildrenPromise,
      mockServerChildrenPromise,
      designChildrenPromise,
      environmentChildrenPromise,
      mcpChildrenPromise,
    ]);
    const map = new Map<string, WorkspaceChildren>();
    workspaceIds.forEach(workspaceId => {
      const scope = workspaceIdToScopeMap.get(workspaceId);
      if (scope === 'collection') {
        map.set(workspaceId, collectionChildrenByWorkspaceIds.get(workspaceId)!);
      } else if (scope === 'mock-server') {
        map.set(workspaceId, mockServerChildrenByWorkspaceIds.get(workspaceId)!);
      } else if (scope === 'design') {
        map.set(workspaceId, designChildrenByWorkspaceIds.get(workspaceId)!);
      } else if (scope === 'environment') {
        map.set(workspaceId, environmentChildrenByWorkspaceIds.get(workspaceId)!);
      } else if (scope === 'mcp') {
        map.set(workspaceId, mcpChildrenByWorkspaceIds.get(workspaceId)!);
      } else {
        console.warn(`Unsupported workspace scope: ${scope} for workspace ${workspaceId}`);
      }
    });
    return map;
  }
  return new Map();
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
      return getWorkspaceChildren(ids, scope);
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
