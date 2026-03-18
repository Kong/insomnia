import {
  type GrpcRequest,
  type McpRequest,
  models,
  type Request,
  services,
  type SocketIORequest,
  type WebSocketRequest,
} from '~/insomnia-data';

const { isGrpcRequest, isGrpcRequestId } = models.grpcRequest;
const { isSocketIORequest, isSocketIORequestId } = models.socketIORequest;
const { isWebSocketRequest, isWebSocketRequestId } = models.webSocketRequest;

export function findByParentId(
  parentId: string,
): Promise<(Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest)[]> {
  return Promise.all([
    services.request.findByParentId(parentId),
    services.grpcRequest.findByParentId(parentId),
    services.webSocketRequest.findByParentId(parentId),
    services.socketIORequest.findByParentId(parentId),
  ]).then(([requests, grpcRequests, webSocketRequests, socketIORequests]) => [
    ...requests,
    ...grpcRequests,
    ...webSocketRequests,
    ...socketIORequests,
  ]);
}

export function getById(
  requestId: string,
): Promise<Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest | undefined> {
  if (isGrpcRequestId(requestId)) {
    return services.grpcRequest.getById(requestId);
  }
  if (isWebSocketRequestId(requestId)) {
    return services.webSocketRequest.getById(requestId);
  }

  if (isSocketIORequestId(requestId)) {
    return services.socketIORequest.getById(requestId);
  }

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    return services.mcpRequest.getById(requestId);
  }
  return services.request.getById(requestId);
}

export function remove(request: Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest) {
  if (isGrpcRequest(request)) {
    return services.grpcRequest.remove(request);
  }
  if (isWebSocketRequest(request)) {
    return services.webSocketRequest.remove(request);
  }

  if (isSocketIORequest(request)) {
    return services.socketIORequest.remove(request);
  }

  if (models.mcpRequest.isMcpRequest(request)) {
    return services.mcpRequest.remove(request);
  }

  return services.request.remove(request);
}

export function update<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.grpcRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.webSocketRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.socketIORequest.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  if (models.mcpRequest.isMcpRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.mcpRequest.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  return services.request.update(request, patch);
}

export function duplicate<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.grpcRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.webSocketRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.socketIORequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return services.request.duplicate(request, patch);
}
