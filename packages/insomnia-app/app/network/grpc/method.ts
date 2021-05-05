import { ValueOf } from 'type-fest';

// https://grpc.github.io/grpc/node/grpc.html#~MethodDefinition
export interface GrpcMethodDefinition {
  path: string;
  originalName: string;
  requestStream: boolean;
  responseStream: boolean;
  requestSerialize: (...args: any[]) => any;
  responseDeserialize: (...args: any[]) => any;
}

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
