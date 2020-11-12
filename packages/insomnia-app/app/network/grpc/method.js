// @flow

// https://grpc.github.io/grpc/node/grpc.html#~MethodDefinition
export type GrpcMethodDefinition = {
  path: string,
  originalName: string,
  requestStream: boolean,
  responseStream: boolean,
  requestSerialize: Function,
  responseDeserialize: Function,
};

export const GrpcMethodTypeEnum = {
  unary: 'unary',
  server: 'server',
  client: 'client',
  bidi: 'bidi',
};

export type GrpcMethodType = $Values<typeof GrpcMethodTypeEnum>;

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

export const GrpcMethodTypeName: { [GrpcMethodType]: string } = {
  [GrpcMethodTypeEnum.unary]: 'Unary',
  [GrpcMethodTypeEnum.server]: 'Server Streaming',
  [GrpcMethodTypeEnum.client]: 'Client Streaming',
  [GrpcMethodTypeEnum.bidi]: 'Bi-directional Streaming',
};

export const canClientStream = (methodType?: GrpcMethodType) =>
  methodType === GrpcMethodTypeEnum.client || methodType === GrpcMethodTypeEnum.bidi;
