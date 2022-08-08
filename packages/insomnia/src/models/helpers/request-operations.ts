import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../grpc-request';
import * as models from '../index';
import { Request } from '../request';
import { isWebSocketRequest, isWebSocketRequestId, WebSocketRequest } from '../websocket-request';

export function getById(requestId: string): Promise<Request | GrpcRequest | WebSocketRequest | null> {
  if (isGrpcRequestId(requestId)) {
    return models.grpcRequest.getById(requestId);
  } else if (isWebSocketRequestId(requestId)) {
    return models.websocketRequest.getById(requestId);
  } else {
    return models.request.getById(requestId);
  }
}

export function remove(request: Request | GrpcRequest | WebSocketRequest) {
  if (isGrpcRequest(request)) {
    return models.grpcRequest.remove(request);
  }
  if (isWebSocketRequest(request)) {
    return models.websocketRequest.remove(request);
  } else {
    return models.request.remove(request);
  }
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
    return models.websocketRequest.update(request, patch);
  } else {
    // @ts-expect-error -- TSCONVERSION
    return models.request.update(request, patch);
  }
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
    return models.websocketRequest.duplicate(request, patch);
  } else {
    // @ts-expect-error -- TSCONVERSION
    return models.request.duplicate(request, patch);
  }
}
