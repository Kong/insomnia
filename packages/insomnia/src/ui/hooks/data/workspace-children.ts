import type { QueryClient } from '@tanstack/react-query';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  ApiSpec,
  BaseModel,
  Environment,
  GrpcRequest,
  GrpcRequestMeta,
  McpRequest,
  MockServer,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequest,
  SocketIORequestMeta,
  WebSocketRequest,
  WebSocketRequestMeta,
  Workspace,
  WorkspaceScope,
} from 'insomnia-data';
import { models } from 'insomnia-data';
import { useCallback } from 'react';

import { database } from '~/common/database';

type CollectionChildDoc = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;
export type { CollectionChildDoc };

type CollectionRequestMeta = RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta;

interface CommonWorkspaceChildren<TChildren, TChildrenMeta extends object = {}> {
  children: TChildren;
  childrenMetas: TChildrenMeta;
}
export interface CollectionWorkspaceChildren
  extends CommonWorkspaceChildren<
    { requestsAndGroups: CollectionChildDoc[] },
    {
      allRequestMetas: CollectionRequestMeta[];
      requestGroupMetas: RequestGroupMeta[];
    }
  > {}

export interface MockServerWorkspaceChildren extends CommonWorkspaceChildren<{ mockServer?: MockServer }> {}

export interface DesignWorkspaceChildren extends CommonWorkspaceChildren<{ apiSpec?: ApiSpec }> {}

export interface EnvironmentWorkspaceChildren extends CommonWorkspaceChildren<{ baseEnvironment?: Environment }> {}

export interface McpWorkspaceChildren extends CommonWorkspaceChildren<{ mcpRequest?: McpRequest }> {}

export type WorkspaceChildren =
  | CollectionWorkspaceChildren
  | MockServerWorkspaceChildren
  | DesignWorkspaceChildren
  | EnvironmentWorkspaceChildren
  | McpWorkspaceChildren;

const emptyWorkspaceChildren: WorkspaceChildren = {
  children: {},
  childrenMetas: {},
};

export const workspaceChildrenKeys = {
  all: ['workspaceChildrenAndMetas'],
  details: (workspaceId: string) => [...workspaceChildrenKeys.all, workspaceId],
};

// Walk the given collection and group every request, request and request-group meta under it.
async function getAllCollectionChildrenAndMetasByWorkspaceIds(
  workspaceIds: string[],
): Promise<Map<string, CollectionWorkspaceChildren>> {
  const allRequestsAndMetaByWorkspaceId = new Map<string, CollectionWorkspaceChildren>();
  if (workspaceIds.length === 0) {
    return allRequestsAndMetaByWorkspaceId;
  }
  let requestGroupIdQueue = [...workspaceIds];
  const allRequestGroups: RequestGroup[] = [];
  // Map to track which workspace each request group belongs to
  const requestGroupToWorkspaceId = new Map<string, string>();
  const requestToWorkspaceId = new Map<string, string>();
  const grpcRequestToWorkspaceId = new Map<string, string>();
  const wsRequestToWorkspaceId = new Map<string, string>();
  const socketIORequestToWorkspaceId = new Map<string, string>();
  // Initialize the map with workspace IDs
  workspaceIds.forEach(workspaceId => {
    requestGroupToWorkspaceId.set(workspaceId, workspaceId);
    requestToWorkspaceId.set(workspaceId, workspaceId);
    grpcRequestToWorkspaceId.set(workspaceId, workspaceId);
    wsRequestToWorkspaceId.set(workspaceId, workspaceId);
    socketIORequestToWorkspaceId.set(workspaceId, workspaceId);
    allRequestsAndMetaByWorkspaceId.set(workspaceId, {
      children: {
        requestsAndGroups: [],
      },
      childrenMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });
  });

  while (requestGroupIdQueue.length) {
    const requestGroups = await database.find<RequestGroup>(models.requestGroup.type, {
      parentId: { $in: requestGroupIdQueue },
    });

    if (requestGroups.length === 0) {
      break;
    }

    requestGroups.forEach(requestGroup => {
      const workspaceId = requestGroupToWorkspaceId.get(requestGroup.parentId);
      if (workspaceId) {
        requestGroupToWorkspaceId.set(requestGroup._id, workspaceId);
      }
    });

    allRequestGroups.push(...requestGroups);
    requestGroupIdQueue = requestGroups.map(rg => rg._id);
  }

  const listOfParentIds = [...workspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)];

  const [reqs, grpcReqs, wsReqs, socketIOReqs] = await Promise.all([
    database.find(models.request.type, { parentId: { $in: listOfParentIds } }),
    database.find<GrpcRequest>(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }),
    database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } }),
    database.find(models.socketIORequest.type, { parentId: { $in: listOfParentIds } }),
  ]);

  const allRequests = [...reqs, ...allRequestGroups, ...grpcReqs, ...wsReqs, ...socketIOReqs] as CollectionChildDoc[];

  const [requestMetas, grpcRequestMetas, requestGroupMetas, wsRequestMetas, socketIORequestMetas] = await Promise.all([
    database.find<RequestMeta>(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } }),
    database.find<GrpcRequestMeta>(models.grpcRequestMeta.type, {
      parentId: { $in: grpcReqs.map(r => r._id) },
    }),
    database.find<RequestGroupMeta>(models.requestGroupMeta.type, {
      parentId: { $in: allRequestGroups.map(requestGroup => requestGroup._id) },
    }),
    database.find<WebSocketRequestMeta>(models.webSocketRequestMeta.type, {
      parentId: { $in: wsReqs.map(r => r._id) },
    }),
    database.find<SocketIORequestMeta>(models.socketIORequestMeta.type, {
      parentId: { $in: socketIOReqs.map(r => r._id) },
    }),
  ]);

  const allRequestMetas = [...requestMetas, ...grpcRequestMetas, ...wsRequestMetas, ...socketIORequestMetas];
  // Associate requests with their workspace IDs and group request metas by workspace ID
  allRequests.forEach(request => {
    const { parentId, _id: requestId } = request;
    const workspaceId = requestGroupToWorkspaceId.get(parentId);
    if (workspaceId) {
      // Track which workspace this request belongs to
      if (models.grpcRequest.isGrpcRequest(request)) {
        grpcRequestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.request.isRequest(request)) {
        requestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.webSocketRequest.isWebSocketRequest(request)) {
        wsRequestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.socketIORequest.isSocketIORequest(request)) {
        socketIORequestToWorkspaceId.set(requestId, workspaceId);
      }
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.children.requestsAndGroups.push(request);
      }
    }
  });
  // Build map of requestGroupMetas by workspace ID
  requestGroupMetas.forEach(requestGroupMeta => {
    const workspaceId = requestGroupToWorkspaceId.get(requestGroupMeta.parentId);
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.childrenMetas.requestGroupMetas.push(requestGroupMeta);
      }
    }
  });
  allRequestMetas.forEach(requestMeta => {
    const requestOrGrpcRequestId = requestMeta.parentId;
    let workspaceId: string | undefined;
    if (models.request.isRequestId(requestOrGrpcRequestId)) {
      workspaceId = requestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.grpcRequest.isGrpcRequestId(requestOrGrpcRequestId)) {
      workspaceId = grpcRequestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.webSocketRequest.isWebSocketRequestId(requestOrGrpcRequestId)) {
      workspaceId = wsRequestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.socketIORequest.isSocketIORequestId(requestOrGrpcRequestId)) {
      workspaceId = socketIORequestToWorkspaceId.get(requestOrGrpcRequestId);
    }
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.childrenMetas.allRequestMetas.push(requestMeta);
      }
    }
  });

  return allRequestsAndMetaByWorkspaceId;
}

const getAllMockServerChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, MockServerWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const mockServers = await database.find<MockServer>(models.mockServer.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        children: {
          mockServer: mockServers.find(mockServer => mockServer.parentId === workspaceId),
        },
        childrenMetas: {},
      });
    });
  }
  return map;
};

const getAllDesignChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, DesignWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const apiSpecs = await database.find<ApiSpec>(models.apiSpec.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        children: {
          apiSpec: apiSpecs.find(apiSpec => apiSpec.parentId === workspaceId),
        },
        childrenMetas: {},
      });
    });
  }
  return map;
};

const getAllEnvironmentChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, EnvironmentWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const environments = await database.find<Environment>(models.environment.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        children: {
          baseEnvironment: environments.find(environment => environment.parentId === workspaceId),
        },
        childrenMetas: {},
      });
    });
  }
  return map;
};

const getAllMcpChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, McpWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const mcpRequests = await database.find<McpRequest>(models.mcpRequest.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        children: {
          mcpRequest: mcpRequests.find(mcpRequest => mcpRequest.parentId === workspaceId),
        },
        childrenMetas: {},
      });
    });
  }
  return map;
};

export const findWorkspaceIdsForChangedCollectionChildDoc = (queryClient: QueryClient, doc: BaseModel): string[] => {
  const workspaceIds: string[] = [];
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
      workspaceIds.push(workspaceId);
    }
  }
  return workspaceIds;
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

const getWorkspaceChildren = async (
  workspaceIds: string[],
  scope?: WorkspaceScope,
): Promise<Map<string, WorkspaceChildren>> => {
  if (scope) {
    switch (scope) {
      case 'design': {
        const designChildrenByWorkspaceIds = await getAllDesignChildrenByWorkspaceIds(workspaceIds);
        return designChildrenByWorkspaceIds;
      }
      case 'collection': {
        const collectionChildrenByWorkspaceIds = await getAllCollectionChildrenAndMetasByWorkspaceIds(workspaceIds);
        return collectionChildrenByWorkspaceIds;
      }
      case 'mock-server': {
        const mockServerChildrenByWorkspaceIds = await getAllMockServerChildrenByWorkspaceIds(workspaceIds);
        return mockServerChildrenByWorkspaceIds;
      }
      case 'environment': {
        const environmentChildrenByWorkspaceIds = await getAllEnvironmentChildrenByWorkspaceIds(workspaceIds);
        return environmentChildrenByWorkspaceIds;
      }
      case 'mcp': {
        const mcpChildrenByWorkspaceIds = await getAllMcpChildrenByWorkspaceIds(workspaceIds);
        return mcpChildrenByWorkspaceIds;
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
    const collectionChildrenPromise = getAllCollectionChildrenAndMetasByWorkspaceIds(collectionWorkspaceIds);
    const mockServerChildrenPromise = getAllMockServerChildrenByWorkspaceIds(mockServerWorkspaceIds);
    const designChildrenPromise = getAllDesignChildrenByWorkspaceIds(designWorkspaceIds);
    const environmentChildrenPromise = getAllEnvironmentChildrenByWorkspaceIds(environmentWorkspaceIds);
    const mcpChildrenPromise = getAllMcpChildrenByWorkspaceIds(mcpWorkspaceIds);
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
        map.set(workspaceId, collectionChildrenByWorkspaceIds.get(workspaceId) ?? emptyWorkspaceChildren);
      } else if (scope === 'mock-server') {
        map.set(workspaceId, mockServerChildrenByWorkspaceIds.get(workspaceId) ?? emptyWorkspaceChildren);
      } else if (scope === 'design') {
        map.set(workspaceId, designChildrenByWorkspaceIds.get(workspaceId) ?? emptyWorkspaceChildren);
      } else if (scope === 'environment') {
        map.set(workspaceId, environmentChildrenByWorkspaceIds.get(workspaceId) ?? emptyWorkspaceChildren);
      } else if (scope === 'mcp') {
        map.set(workspaceId, mcpChildrenByWorkspaceIds.get(workspaceId) ?? emptyWorkspaceChildren);
      } else {
        console.warn(`Unsupported workspace scope: ${scope} for workspace ${workspaceId}`);
        map.set(workspaceId, emptyWorkspaceChildren);
      }
    });
    return map;
  }
  return new Map();
};

// Pending batches keyed by scope. Reads must only batch together when they share a scope: the batch runs a
// single `getWorkspaceChildren(ids, scope)` sweep, so mixing scopes (e.g. the sidebar's 'collection' with
// the project index's 'design'/'mock-server') would apply one caller's scope to every workspace in the batch.
const SCOPELESS_BATCH_KEY = '__all__';
const pendingBatches = new Map<string, { ids: string[]; batch: Promise<Map<string, WorkspaceChildren>> }>();

//Combine all per-workspace reads of the same scope requested within the same microtask into a single batched DB sweep
const loadWorkspaceChildrenBatched = (workspaceId: string, scope?: WorkspaceScope): Promise<WorkspaceChildren> => {
  const scopeKey = scope ?? SCOPELESS_BATCH_KEY;
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
  pending.ids.push(workspaceId);
  return pending.batch.then(map => map.get(workspaceId) ?? emptyWorkspaceChildren);
};

export const useWorkspaceChildren = (
  workspaceId: string,
  scope?: WorkspaceScope,
): UseQueryResult<WorkspaceChildren> => {
  return useQuery({
    queryKey: workspaceChildrenKeys.details(workspaceId),
    queryFn: () => loadWorkspaceChildrenBatched(workspaceId, scope),
  });
};

export const useWorkspaceChildrenByWorkspaceIds = (workspaceIds: string[], scope?: WorkspaceScope) =>
  useQueries({
    queries: workspaceIds.map(workspaceId => ({
      queryKey: workspaceChildrenKeys.details(workspaceId),
      queryFn: () => loadWorkspaceChildrenBatched(workspaceId, scope),
    })),
    combine: useCallback(
      (results: UseQueryResult<WorkspaceChildren>[]) => {
        const dataByWorkspaceId = new Map<string, WorkspaceChildren>();
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
