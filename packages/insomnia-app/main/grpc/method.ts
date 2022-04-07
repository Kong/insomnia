import { MethodDefinition } from '@grpc/grpc-js';
import { ValueOf } from 'type-fest';

// TODO(TSCONVERSION) remove this alias and type MethodDefinition correctly
export type GrpcMethodDefinition = MethodDefinition<any, any>;

export const GrpcMethodTypeEnum = {
  unary: 'unary',
  server: 'server',
  client: 'client',
  bidi: 'bidi',
} as const;

export type GrpcMethodType = ValueOf<typeof GrpcMethodTypeEnum>;

export const getMethodType = ({
  requestStream,
  responseStream,
}: GrpcMethodDefinition): GrpcMethodType => {
  if (requestStream) {
    if (responseStream) {
      return GrpcMethodTypeEnum.bidi;
    } else {
      return GrpcMethodTypeEnum.client;
    }
  } else {
    if (responseStream) {
      return GrpcMethodTypeEnum.server;
    } else {
      return GrpcMethodTypeEnum.unary;
    }
  }
};

export const GrpcMethodTypeName = {
  [GrpcMethodTypeEnum.unary]: 'Unary',
  [GrpcMethodTypeEnum.server]: 'Server Streaming',
  [GrpcMethodTypeEnum.client]: 'Client Streaming',
  [GrpcMethodTypeEnum.bidi]: 'Bi-directional Streaming',
} as const;

export const GrpcMethodTypeAcronym = {
  [GrpcMethodTypeEnum.unary]: 'U',
  [GrpcMethodTypeEnum.server]: 'SS',
  [GrpcMethodTypeEnum.client]: 'CS',
  [GrpcMethodTypeEnum.bidi]: 'BD',
} as const;

export const canClientStream = (methodType?: GrpcMethodType) =>
  methodType === GrpcMethodTypeEnum.client || methodType === GrpcMethodTypeEnum.bidi;
