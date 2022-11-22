import type { Schema } from '@develohpanda/fluent-builder';
import { MethodDefinition } from '@grpc/grpc-js';

export const grpcMethodDefinitionSchema: Schema<MethodDefinition<any, any>> = {
  path: () => '/package.service/method',
  originalName: () => 'method',
  responseStream: () => false,
  requestStream: () => true,
  // @ts-expect-error -- TSCONVERSION unexpected return type
  requestSerialize: () => () => {}, // not using jest.fn to avoid the overhead
  responseDeserialize: () => () => {}, // not using jest.fn to avoid the overhead
};
