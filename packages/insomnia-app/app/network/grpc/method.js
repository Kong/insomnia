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

// The values of this are converted from a two digit binary number xy, where:
// x denotes request streaming, and
// y denotes response streaming
export const GrpcMethodTypeEnum = {
  unary: 0, // 00
  server: 1, // 01
  client: 2, // 10
  bidi: 3, // 11
};

export type GrpcMethodType = $Values<typeof GrpcMethodTypeEnum>;

export const getMethodType = ({
  requestStream,
  responseStream,
}: GrpcMethodDefinition): GrpcMethodType => parseInt(`${+requestStream}${+responseStream}`, 2);

export const GrpcMethodTypeName: { [GrpcMethodType]: string } = {
  [GrpcMethodTypeEnum.unary]: 'Unary',
  [GrpcMethodTypeEnum.server]: 'Server Streaming',
  [GrpcMethodTypeEnum.client]: 'Client Streaming',
  [GrpcMethodTypeEnum.bidi]: 'Bi-directional Streaming',
};
