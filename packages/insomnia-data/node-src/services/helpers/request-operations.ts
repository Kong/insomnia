import type { GrpcRequest, McpRequest, Request, SocketIORequest, WebSocketRequest } from 'insomnia-data';
import { models } from 'insomnia-data';

import * as grpcRequestService from '../grpc-request';
import * as mcpRequestService from '../mcp-request';
import * as requestService from '../request';
import * as socketIORequestService from '../socket-io-request';
import * as webSocketRequestService from '../websocket-request';

export function findRequestByParentId(
  parentId: string,
): Promise<(Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest)[]> {
  return Promise.all([
    requestService.findByParentId(parentId),
    grpcRequestService.findByParentId(parentId),
    webSocketRequestService.findByParentId(parentId),
    socketIORequestService.findByParentId(parentId),
  ]).then(([requests, grpcRequests, webSocketRequests, socketIORequests]) => [
    ...requests,
    ...grpcRequests,
    ...webSocketRequests,
    ...socketIORequests,
  ]);
}

export function getRequestById(
  requestId: string,
): Promise<Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest | undefined> {
  if (models.grpcRequest.isGrpcRequestId(requestId)) {
    return grpcRequestService.getById(requestId);
  }
  if (models.webSocketRequest.isWebSocketRequestId(requestId)) {
    return webSocketRequestService.getById(requestId);
  }

  if (models.socketIORequest.isSocketIORequestId(requestId)) {
    return socketIORequestService.getById(requestId);
  }

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    return mcpRequestService.getById(requestId);
  }
  return requestService.getById(requestId);
}

export function removeRequest(request: Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest) {
  if (models.grpcRequest.isGrpcRequest(request)) {
    return grpcRequestService.remove(request);
  }
  if (models.webSocketRequest.isWebSocketRequest(request)) {
    return webSocketRequestService.remove(request);
  }

  if (models.socketIORequest.isSocketIORequest(request)) {
    return socketIORequestService.remove(request);
  }

  if (models.mcpRequest.isMcpRequest(request)) {
    return mcpRequestService.remove(request);
  }

  return requestService.remove(request);
}

export function updateRequest<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (models.grpcRequest.isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return grpcRequestService.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (models.webSocketRequest.isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return webSocketRequestService.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (models.socketIORequest.isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return socketIORequestService.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  if (models.mcpRequest.isMcpRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return mcpRequestService.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  return requestService.update(request, patch);
}

export function duplicateRequest<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (models.grpcRequest.isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return grpcRequestService.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (models.webSocketRequest.isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return webSocketRequestService.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (models.socketIORequest.isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return socketIORequestService.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return requestService.duplicate(request, patch);
}
