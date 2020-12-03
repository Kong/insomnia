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

export const getGrpcPathSegments = (path: string): GrpcPathSegments => {
  const result = PROTO_PATH_REGEX.exec(path);

  const packageName = result?.groups?.package;
  const serviceName = result?.groups?.service;
  const methodName = result?.groups?.method;

  return { packageName, serviceName, methodName };
};

export type GrpcMethodInfo = {
  segments: GrpcPathSegments,
  type: GrpcMethodType,
  fullPath: string,
};

type GroupedGrpcMethodInfo = {
  [packageName: string]: Array<GrpcMethodInfo>,
};

export const groupGrpcMethodsByPackage = (
  methods: Array<GrpcMethodDefinition>,
): GroupedGrpcMethodInfo => {
  const mapped = methods.map(m => ({
    segments: getGrpcPathSegments(m.path),
    type: getMethodType(m),
    fullPath: m.path,
  }));

  return groupBy(mapped, m => m.segments.packageName || '');
};

export const getShortGrpcPath = (
  { packageName, serviceName, methodName }: GrpcPathSegments,
  fullPath: string,
): string => {
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};
