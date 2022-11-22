import { MethodDefinition } from '@grpc/grpc-js';

export type GrpcMethodType = 'unary' | 'server' | 'client' | 'bidi';

export const getMethodType = ({
  requestStream,
  responseStream,
}: MethodDefinition<any, any>): GrpcMethodType => {
  if (requestStream) {
    if (responseStream) {
      return 'bidi';
    } else {
      return 'client';
    }
  } else {
    if (responseStream) {
      return 'server';
    } else {
      return 'unary';
    }
  }
};

export const GrpcMethodTypeName = {
  unary: 'Unary',
  server: 'Server Streaming',
  client: 'Client Streaming',
  bidi: 'Bi-directional Streaming',
} as const;

export const GrpcMethodTypeAcronym = {
  unary: 'U',
  server: 'SS',
  client: 'CS',
  bidi: 'BD',
} as const;

export const canClientStream = (methodType?: GrpcMethodType) =>
  methodType === 'client' || methodType === 'bidi';
