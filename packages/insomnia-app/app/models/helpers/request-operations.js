// @flow
import * as models from '../index';
import { isGrpcRequest, isGrpcRequestId } from './is-model';
import type { GrpcRequest } from '../grpc-request';

export function getById(requestId: string): Promise<Request | GrpcRequest | null> {
  return isGrpcRequestId(requestId)
    ? models.grpcRequest.getById(requestId)
    : models.request.getById(requestId);
}

export function remove<T>(request: T): Promise<void> {
  return isGrpcRequest(request)
    ? models.grpcRequest.remove(request)
    : models.request.remove(request);
}

export function update<T>(request: T, patch: $Shape<T> = {}): Promise<T> {
  return isGrpcRequest(request)
    ? models.grpcRequest.update(request, patch)
    : models.request.update(request, patch);
}

export function duplicate<T>(request: T, patch: $Shape<T> = {}): Promise<T> {
  return isGrpcRequest(request)
    ? models.grpcRequest.duplicate(request, patch)
    : models.request.duplicate(request, patch);
}
