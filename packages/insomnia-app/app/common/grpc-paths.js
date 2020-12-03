// @flow

import type { GrpcMethodDefinition, GrpcMethodType } from '../network/grpc/method';
import { groupBy } from 'lodash';
import { getMethodType } from '../network/grpc/method';

const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;

type GrpcPathSegments = {
  packageName?: string,
  serviceName?: string,
  methodName?: string,
};

// Split a full gRPC path into it's segments
export const getGrpcPathSegments = (path: string): GrpcPathSegments => {
  const result = PROTO_PATH_REGEX.exec(path);

  const packageName = result?.groups?.package;
  const serviceName = result?.groups?.service;
  const methodName = result?.groups?.method;

  return { packageName, serviceName, methodName };
};

// If all segments are found, return a shorter path, otherwise the original path
export const getShortGrpcPath = (
  { packageName, serviceName, methodName }: GrpcPathSegments,
  fullPath: string,
): string => {
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};

export type GrpcMethodInfo = {
  segments: GrpcPathSegments,
  type: GrpcMethodType,
  fullPath: string,
};

type GroupedGrpcMethodInfo = {
  [packageName: string]: Array<GrpcMethodInfo>,
};

export const NO_PACKAGE_KEY = 'no-package';

const getMethodInfo = (method: GrpcMethodDefinition): GrpcMethodInfo => ({
  segments: getGrpcPathSegments(method.path),
  type: getMethodType(method),
  fullPath: method.path,
});

export const groupGrpcMethodsByPackage = (
  methods: Array<GrpcMethodDefinition>,
): GroupedGrpcMethodInfo =>
  groupBy(methods.map(getMethodInfo), m => m.segments.packageName || NO_PACKAGE_KEY);
