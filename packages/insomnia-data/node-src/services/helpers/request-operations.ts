import {
  type GrpcRequest,
  type McpRequest,
  models,
  type Request,
  type SocketIORequest,
  type WebSocketRequest,
} from 'insomnia-data';

import * as grpcRequestServices from '../grpc-request';
import * as mcpRequestServices from '../mcp-request';
import * as requestServices from '../request';
import * as socketIORequestServices from '../socket-io-request';
import * as webSocketRequestServices from '../websocket-request';

const { isGrpcRequest, isGrpcRequestId } = models.grpcRequest;
const { isSocketIORequest, isSocketIORequestId } = models.socketIORequest;
const { isWebSocketRequest, isWebSocketRequestId } = models.webSocketRequest;

export function findRequestByParentId(
  parentId: string,
): Promise<(Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest)[]> {
  return Promise.all([
    requestServices.findByParentId(parentId),
    grpcRequestServices.findByParentId(parentId),
    webSocketRequestServices.findByParentId(parentId),
    socketIORequestServices.findByParentId(parentId),
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
  if (isGrpcRequestId(requestId)) {
    return grpcRequestServices.getById(requestId);
  }
  if (isWebSocketRequestId(requestId)) {
    return webSocketRequestServices.getById(requestId);
  }

  if (isSocketIORequestId(requestId)) {
    return socketIORequestServices.getById(requestId);
  }

  if (models.mcpRequest.isMcpRequestId(requestId)) {
    return mcpRequestServices.getById(requestId);
  }
  return requestServices.getById(requestId);
}

export function removeRequest(request: Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest) {
  if (isGrpcRequest(request)) {
    return grpcRequestServices.remove(request);
  }
  if (isWebSocketRequest(request)) {
    return webSocketRequestServices.remove(request);
  }

  if (isSocketIORequest(request)) {
    return socketIORequestServices.remove(request);
  }

  if (models.mcpRequest.isMcpRequest(request)) {
    return mcpRequestServices.remove(request);
  }

  return requestServices.remove(request);
}

export function updateRequest<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return grpcRequestServices.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return webSocketRequestServices.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return socketIORequestServices.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  if (models.mcpRequest.isMcpRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return mcpRequestServices.update(request, patch);
  }

  // @ts-expect-error -- TSCONVERSION
  return requestServices.update(request, patch);
}

export function duplicateRequest<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return grpcRequestServices.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return webSocketRequestServices.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isSocketIORequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return socketIORequestServices.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return requestServices.duplicate(request, patch);
}
