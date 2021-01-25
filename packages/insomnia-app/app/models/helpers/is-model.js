// @flow
import type { BaseModel } from '../index';
import { grpcRequest, request, requestGroup, protoFile, protoDirectory, workspace } from '../index';

export function isGrpcRequest(obj: BaseModel): boolean {
  return obj.type === grpcRequest.type;
}

export function isGrpcRequestId(id: string): boolean {
  return id.startsWith(`${grpcRequest.prefix}_`);
}

export function isRequest(obj: BaseModel): boolean {
  return obj.type === request.type;
}

// TODO: Invalid until we can ensure all requests are prefixed by the id correctly INS-341
// export function isRequestId(id: string): boolean {
//   return id.startsWith(`${request.prefix}_`);
// }

export function isRequestGroup(obj: BaseModel): boolean {
  return obj.type === requestGroup.type;
}

export function isProtoFile(obj: BaseModel): boolean {
  return obj.type === protoFile.type;
}

export function isProtoDirectory(obj: BaseModel): boolean {
  return obj.type === protoDirectory.type;
}

export function isWorkspace(obj: BaseModel): boolean {
  return obj.type === workspace.type;
}
