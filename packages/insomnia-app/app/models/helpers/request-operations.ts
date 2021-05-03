import { $Shape } from 'utility-types';
import { GrpcRequest } from '../grpc-request';
import { Request } from '../request';
import * as models from '../index';
import { isGrpcRequest, isGrpcRequestId } from './is-model';

export function getById(requestId: string): Promise<Request | GrpcRequest | null> {
  return isGrpcRequestId(requestId)
    ? models.grpcRequest.getById(requestId)
    : models.request.getById(requestId);
}

export function remove(request: Request | GrpcRequest): Promise<void> {
  return isGrpcRequest(request)
    ? models.grpcRequest.remove(request)
    : models.request.remove(request);
}

export function update<T extends object>(request: T, patch: $Shape<T> = {}): Promise<T> {
  // @ts-expect-error
  return isGrpcRequest(request)
    ? models.grpcRequest.update(request, patch)
  // @ts-expect-error
    : models.request.update(request, patch);
}

export function duplicate<T extends object>(request: T, patch: $Shape<T> = {}): Promise<T> {
  // @ts-expect-error
  return isGrpcRequest(request)
    ? models.grpcRequest.duplicate(request, patch)
  // @ts-expect-error
    : models.request.duplicate(request, patch);
}
