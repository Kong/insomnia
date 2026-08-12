import type {
  ApiSpec,
  CollectionChildDoc,
  CollectionWorkspaceChildren,
  DesignWorkspaceChildren,
  Environment,
  EnvironmentWorkspaceChildren,
  GrpcRequestMeta,
  McpRequest,
  McpWorkspaceChildren,
  MockServer,
  MockServerWorkspaceChildren,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequestMeta,
  WebSocketRequestMeta,
  Workspace,
  WorkspaceChildren,
  WorkspaceChildrenForScope,
  WorkspaceScope,
} from 'insomnia-data';
import { database, models } from 'insomnia-data';

// Walk the given collection and group every request, request and request-group meta under it.
export const getAllCollectionChildrenAndMetasByWorkspaceIds = async (
  workspaceIds: string[],
): Promise<Map<string, CollectionWorkspaceChildren>> => {
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
      data: {
        requestsAndGroups: [],
      },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
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
    database.find(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }),
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
        workspaceData.data.requestsAndGroups.push(request);
      }
    }
  });
  // Build map of requestGroupMetas by workspace ID
  requestGroupMetas.forEach(requestGroupMeta => {
    const workspaceId = requestGroupToWorkspaceId.get(requestGroupMeta.parentId);
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.dataMetas.requestGroupMetas.push(requestGroupMeta);
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
        workspaceData.dataMetas.allRequestMetas.push(requestMeta);
      }
    }
  });

  return allRequestsAndMetaByWorkspaceId;
};

export const getAllDesignChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, DesignWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const apiSpecs = await database.find<ApiSpec>(models.apiSpec.type, {
      parentId: { $in: workspaceIds },
    });
    const designRequestsAndMetas = await getAllCollectionChildrenAndMetasByWorkspaceIds(workspaceIds);
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        data: {
          apiSpec: apiSpecs.find(apiSpec => apiSpec.parentId === workspaceId),
          requestsAndGroups: designRequestsAndMetas.get(workspaceId)?.data.requestsAndGroups || [],
        },
        dataMetas: {
          allRequestMetas: designRequestsAndMetas.get(workspaceId)?.dataMetas.allRequestMetas || [],
          requestGroupMetas: designRequestsAndMetas.get(workspaceId)?.dataMetas.requestGroupMetas || [],
        },
      });
    });
  }
  return map;
};

export const getAllMcpChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, McpWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const mcpRequests = await database.find<McpRequest>(models.mcpRequest.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        data: {
          mcpRequest: mcpRequests.find(mcpRequest => mcpRequest.parentId === workspaceId)!,
        },
        dataMetas: {},
      });
    });
  }
  return map;
};

export const getAllEnvironmentChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, EnvironmentWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const environments = await database.find<Environment>(models.environment.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        data: {
          baseEnvironment: environments.find(environment => environment.parentId === workspaceId)!,
        },
        dataMetas: {},
      });
    });
  }
  return map;
};

export const getAllMockServerChildrenByWorkspaceIds = async (workspaceIds: string[]) => {
  const map = new Map<string, MockServerWorkspaceChildren>();
  if (workspaceIds.length > 0) {
    const mockServers = await database.find<MockServer>(models.mockServer.type, {
      parentId: { $in: workspaceIds },
    });
    workspaceIds.forEach(workspaceId => {
      map.set(workspaceId, {
        data: {
          mockServer: mockServers.find(mockServer => mockServer.parentId === workspaceId),
        },
        dataMetas: {},
      });
    });
  }
  return map;
};

export const getWorkspaceChildren = async <S extends WorkspaceScope | undefined = undefined>(
  workspaceIds: string[],
  scope?: S,
): Promise<Map<string, WorkspaceChildrenForScope<S>>> => {
  if (scope) {
    switch (scope) {
      case 'design': {
        const designChildrenByWorkspaceIds = await getAllDesignChildrenByWorkspaceIds(workspaceIds);
        return designChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'collection': {
        const collectionChildrenByWorkspaceIds = await getAllCollectionChildrenAndMetasByWorkspaceIds(workspaceIds);
        return collectionChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'mock-server': {
        const mockServerChildrenByWorkspaceIds = await getAllMockServerChildrenByWorkspaceIds(workspaceIds);
        return mockServerChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'environment': {
        const environmentChildrenByWorkspaceIds = await getAllEnvironmentChildrenByWorkspaceIds(workspaceIds);
        return environmentChildrenByWorkspaceIds as Map<string, WorkspaceChildrenForScope<S>>;
      }
      case 'mcp': {
        const mcpChildrenByWorkspaceIds = await getAllMcpChildrenByWorkspaceIds(workspaceIds);
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
    return map as Map<string, WorkspaceChildrenForScope<S>>;
  }
  return new Map();
};
