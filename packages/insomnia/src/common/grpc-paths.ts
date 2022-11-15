import type { GrpcMethodDefinition, GrpcMethodType } from '../network/grpc/method';
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

const getMethodInfo = (method: GrpcMethodDefinition): GrpcMethodInfo => ({
  segments: getGrpcPathSegments(method.path),
  type: getMethodType(method),
  fullPath: method.path,
});

export const NO_PACKAGE_KEY = 'no-package';

function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach(item => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

export const groupGrpcMethodsByPackage = (grpcMethodDefinitions: GrpcMethodDefinition[]) =>
  groupBy(grpcMethodDefinitions.map(getMethodInfo), ({ segments }) => segments.packageName || NO_PACKAGE_KEY);
