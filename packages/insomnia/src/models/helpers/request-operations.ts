import type { GrpcRequest, McpRequest } from '~/insomnia-data';
import { services } from '~/insomnia-data';

import * as models from '../index';
import type { Request } from '../request';
import { isSocketIORequest, isSocketIORequestId, type SocketIORequest } from '../socket-io-request';
import { isWebSocketRequest, isWebSocketRequestId, type WebSocketRequest } from '../websocket-request';

export function findByParentId(
  parentId: string,
): Promise<(Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest)[]> {
  return Promise.all([
    models.request.findByParentId(parentId),
    services.grpcRequest.findByParentId(parentId),
    models.webSocketRequest.findByParentId(parentId),
    models.socketIORequest.findByParentId(parentId),
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
  if (models.grpcRequest.isGrpcRequestId(requestId)) {
    return services.grpcRequest.getById(requestId);
  }
  if (isWebSocketRequestId(requestId)) {
    return models.webSocketRequest.getById(requestId);
  }

  if (isSocketIORequestId(requestId)) {
    return models.socketIORequest.getById(requestId);
  }

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    return services.mcpRequest.getById(requestId);
  }
  return models.request.getById(requestId);
}

export function remove(request: Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest) {
  if (models.grpcRequest.isGrpcRequest(request)) {
    return services.grpcRequest.remove(request);
  }
  if (isWebSocketRequest(request)) {
    return models.webSocketRequest.remove(request);
  }

  if (isSocketIORequest(request)) {
    return models.socketIORequest.remove(request);
  }

  if (models.mcpRequest.isMcpRequest(request)) {
    return services.mcpRequest.remove(request);
  }

  return models.request.remove(request);
}

export function update<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (models.grpcRequest.isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.grpcRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.webSocketRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.socketIORequest.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  if (models.mcpRequest.isMcpRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.mcpRequest.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  return models.request.update(request, patch);
}

export function duplicate<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (models.grpcRequest.isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return services.grpcRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.webSocketRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.socketIORequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return models.request.duplicate(request, patch);
}
