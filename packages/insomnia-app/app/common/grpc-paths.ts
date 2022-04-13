import { MethodDefinition } from '@grpc/grpc-js';
import { groupBy, map, pipe } from 'ramda';
import { ValueOf } from 'type-fest';

export const GrpcMethodTypeEnum = {
  unary: 'unary',
  server: 'server',
  client: 'client',
  bidi: 'bidi',
} as const;

export type GrpcMethodType = ValueOf<typeof GrpcMethodTypeEnum>;
import { getMethodType } from '../network/grpc/method';
const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;

interface GrpcPathSegments {
  packageName?: string;
  serviceName?: string;
  methodName?: string;
}

// Split a full gRPC path into it's segments
export const getGrpcPathSegments = (path: string): GrpcPathSegments => {
  const result = PROTO_PATH_REGEX.exec(path);
  const packageName = result?.groups?.package;
  const serviceName = result?.groups?.service;
  const methodName = result?.groups?.method;
  return {
    packageName,
    serviceName,
    methodName,
  };
};

// If all segments are found, return a shorter path, otherwise the original path
export const getShortGrpcPath = (
  { packageName, serviceName, methodName }: GrpcPathSegments,
  fullPath: string,
): string => {
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};

export interface GrpcMethodInfo {
  segments: GrpcPathSegments;
  type: GrpcMethodType;
  fullPath: string;
}

const getMethodInfo = (method: MethodDefinition<any, any>): GrpcMethodInfo => ({
  segments: getGrpcPathSegments(method.path),
  type: getMethodType(method),
  fullPath: method.path,
});

export const NO_PACKAGE_KEY = 'no-package';

export const groupGrpcMethodsByPackage = (grpcMethodDefinitions: MethodDefinition<any, any>[]) => pipe(
  () => grpcMethodDefinitions,
  map(getMethodInfo),
  groupBy(({ segments }) => segments.packageName || NO_PACKAGE_KEY),
)();
