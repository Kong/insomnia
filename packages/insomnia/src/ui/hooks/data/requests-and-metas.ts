import type { QueryClient } from '@tanstack/react-query';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  BaseModel,
  GrpcRequest,
  GrpcRequestMeta,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequest,
  SocketIORequestMeta,
  WebSocketRequest,
  WebSocketRequestMeta,
} from 'insomnia-data';
import { models } from 'insomnia-data';
import { useCallback } from 'react';

import { database } from '~/common/database';

type AllRequestDoc = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;

export type { AllRequestDoc };

export interface AllRequestsAndMetaInWorkspace {
  allRequests: AllRequestDoc[];
  allRequestMetas: (RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta)[];
  requestGroupMetas: RequestGroupMeta[];
}

const EMPTY_REQUESTS_AND_META: AllRequestsAndMetaInWorkspace = {
  allRequests: [],
  allRequestMetas: [],
  requestGroupMetas: [],
};

export const requestsAndMetaKeys = {
  all: ['requestsAndMetas'],
  detail: (workspaceId: string) => [...requestsAndMetaKeys.all, workspaceId],
};

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

// Given a changed request/group/meta doc, find the cached workspace id(s) whose collection contains it.
export const findWorkspaceIdsForChangedDoc = (queryClient: QueryClient, doc: BaseModel): string[] => {
  const workspaceIds: string[] = [];
  const cachedCollections = queryClient.getQueriesData<AllRequestsAndMetaInWorkspace>({
    queryKey: requestsAndMetaKeys.all,
  });
  for (const [queryKey, data] of cachedCollections) {
    const workspaceId = queryKey[1] as string;
    if (!data) {
      continue;
    }
    if (
      doc.parentId === workspaceId ||
      data.allRequests.some(request => request._id === doc._id || request._id === doc.parentId)
    ) {
      workspaceIds.push(workspaceId);
    }
  }
  return workspaceIds;
};

// Apply an `update` change for a single doc to a cached workspace tree without re-querying NeDB.
export function updateWorkspaceDataWithUpdatedDoc(
  data: AllRequestsAndMetaInWorkspace,
  doc: BaseModel,
): AllRequestsAndMetaInWorkspace | null {
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
    const allRequests = replaceById(data.allRequests);
    return allRequests ? { ...data, allRequests } : null;
  }
  if (REQUEST_META_DOC_TYPES.includes(doc.type)) {
    const allRequestMetas = replaceById(data.allRequestMetas);
    return allRequestMetas ? { ...data, allRequestMetas } : null;
  }
  if (doc.type === models.requestGroupMeta.type) {
    const requestGroupMetas = replaceById(data.requestGroupMetas);
    return requestGroupMetas ? { ...data, requestGroupMetas } : null;
  }
  return null;
}

// Batched read: walk the request-group tree for the given workspaces and group every
// request, request and request-group meta under its owning workspace id.
export async function getAllRequestsAndMetaByWorkspace(
  workspaceIds: string[],
): Promise<Map<string, AllRequestsAndMetaInWorkspace>> {
  const allRequestsAndMetaByWorkspaceId = new Map<string, AllRequestsAndMetaInWorkspace>();
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
    allRequestsAndMetaByWorkspaceId.set(workspaceId, { allRequests: [], allRequestMetas: [], requestGroupMetas: [] });
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

  const allRequests = [...reqs, ...allRequestGroups, ...grpcReqs, ...wsReqs, ...socketIOReqs] as AllRequestDoc[];

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
        workspaceData.allRequests.push(request);
      }
    }
  });
  // Build map of requestGroupMetas by workspace ID
  requestGroupMetas.forEach(requestGroupMeta => {
    const workspaceId = requestGroupToWorkspaceId.get(requestGroupMeta.parentId);
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.requestGroupMetas.push(requestGroupMeta);
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
        workspaceData.allRequestMetas.push(requestMeta);
      }
    }
  });

  return allRequestsAndMetaByWorkspaceId;
}

export const getRequestsAndMetaByWorkspaceId = async (workspaceId: string): Promise<AllRequestsAndMetaInWorkspace> => {
  const result = await getAllRequestsAndMetaByWorkspace([workspaceId]);
  return result.get(workspaceId) ?? EMPTY_REQUESTS_AND_META;
};

let pendingWorkspaceIds: string[] = [];
let pendingBatch: Promise<Map<string, AllRequestsAndMetaInWorkspace>> | null = null;

// Combine all per-workspace reads requested within the same microtask into a single batched DB sweep
const loadRequestsAndMetaBatched = (workspaceId: string): Promise<AllRequestsAndMetaInWorkspace> => {
  pendingWorkspaceIds.push(workspaceId);
  if (!pendingBatch) {
    pendingBatch = Promise.resolve().then(() => {
      const ids = [...pendingWorkspaceIds];
      console.log(`Batching requests/meta load for workspaces: ${ids.join(', ')}`);
      pendingWorkspaceIds = [];
      pendingBatch = null;
      return getAllRequestsAndMetaByWorkspace(ids);
    });
  }
  return pendingBatch.then(map => map.get(workspaceId) ?? EMPTY_REQUESTS_AND_META);
};

// A single workspace's collection children (requests/requestGroups) and their metas.
export const useRequestsAndMeta = (workspaceId: string): UseQueryResult<AllRequestsAndMetaInWorkspace> => {
  return useQuery({
    queryKey: requestsAndMetaKeys.detail(workspaceId),
    queryFn: () => loadRequestsAndMetaBatched(workspaceId),
  });
};

export const useRequestsAndMetaByWorkspaceIds = (workspaceIds: string[]) =>
  useQueries({
    queries: workspaceIds.map(workspaceId => ({
      queryKey: requestsAndMetaKeys.detail(workspaceId),
      queryFn: () => loadRequestsAndMetaBatched(workspaceId),
    })),
    combine: useCallback(
      (results: UseQueryResult<AllRequestsAndMetaInWorkspace>[]) => {
        const dataByWorkspaceId = new Map<string, AllRequestsAndMetaInWorkspace>();
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
