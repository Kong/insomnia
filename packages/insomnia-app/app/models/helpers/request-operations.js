// @flow
import * as models from '../index';
import { isGrpcRequest } from './is-model';

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
