import { GrpcRequest, isGrpcRequest, isGrpcRequestId } from '../grpc-request';
import * as models from '../index';
import { Request } from '../request';
import { isWebSocketRequest, WebSocketRequest } from '../websocket-request';

export function getById(requestId: string): Promise<Request | GrpcRequest | null> {
  return isGrpcRequestId(requestId)
    ? models.grpcRequest.getById(requestId)
    : models.request.getById(requestId);
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
  return isGrpcRequest(request)
    ? models.grpcRequest.update(request, patch)
  // @ts-expect-error -- TSCONVERSION
    : models.request.update(request, patch);
}

export function duplicate<T extends object>(request: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  return isGrpcRequest(request)
    ? models.grpcRequest.duplicate(request, patch)
  // @ts-expect-error -- TSCONVERSION
    : models.request.duplicate(request, patch);
}
