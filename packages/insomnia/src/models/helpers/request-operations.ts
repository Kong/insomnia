import { invariant } from '@remix-run/router';

import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../grpc-request';
import * as models from '../index';
import { Request } from '../request';
import { isWebSocketRequest, isWebSocketRequestId, WebSocketRequest } from '../websocket-request';

export function getById(requestId: string): Promise<Request | GrpcRequest | WebSocketRequest | null> {
  if (isGrpcRequestId(requestId)) {
    return models.grpcRequest.getById(requestId);
  }
  if (isWebSocketRequestId(requestId)) {
    return models.webSocketRequest.getById(requestId);
  }
  return models.request.getById(requestId);
}

export function remove(request: Request | GrpcRequest | WebSocketRequest) {
  if (isGrpcRequest(request)) {
    return models.grpcRequest.remove(request);
  }
  if (isWebSocketRequest(request)) {
    return models.webSocketRequest.remove(request);
  }
  return models.request.remove(request);
}

export function update<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.grpcRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.webSocketRequest.update(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return models.request.update(request, patch);
}

export async function updateById(requestId: string, patch: any): Promise<Request | GrpcRequest | WebSocketRequest | null> {
  if (isGrpcRequestId(requestId)) {
    const request = await models.grpcRequest.getById(requestId);
    invariant(request, `Failed to find gRPC request for _id "${requestId}"`);
    return models.grpcRequest.update(request, patch);
  }
  if (isWebSocketRequestId(requestId)) {
    const request = await models.webSocketRequest.getById(requestId);
    invariant(request, `Failed to find WebSocket request for _id "${requestId}"`);
    return models.webSocketRequest.update(request, patch);
  }
  const request = await models.request.getById(requestId);
  invariant(request, `Failed to find request for _id "${requestId}"`);
  return models.request.getById(requestId);
}

export function duplicate<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  if (isGrpcRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.grpcRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  if (isWebSocketRequest(request)) {
    // @ts-expect-error -- TSCONVERSION
    return models.webSocketRequest.duplicate(request, patch);
  }
  // @ts-expect-error -- TSCONVERSION
  return models.request.duplicate(request, patch);
}
