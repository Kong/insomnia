// @flow
import type { BaseModel } from '../index';
import { grpcRequest, request, requestGroup, protoFile } from '../index';

export function isGrpcRequest(obj: BaseModel): boolean {
  return obj.type === grpcRequest.type;
}

export function isGrpcRequestId(id: string): boolean {
  return id.startsWith(`${grpcRequest.prefix}_`);
}

export function isRequest(obj: BaseModel): boolean {
  return obj.type === request.type;
}

export function isRequestId(id: string): boolean {
  return id.startsWith(`${request.prefix}_`);
}

export function isRequestGroup(obj: BaseModel): boolean {
  return obj.type === requestGroup.type;
}

export function isProtoFile(obj: BaseModel): boolean {
  return obj.type === protoFile.type;
}
