// @flow
import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcMethodDefinition } from '../../../../network/grpc/method';

export const grpcMethodDefinitionSchema: Schema<GrpcMethodDefinition> = {
  path: () => '/package.service/method',
  originalName: () => 'method',
  responseStream: () => false,
  requestStream: () => true,
  requestSerialize: () => () => {}, // not using jest.fn to avoid the overhead
  responseDeserialize: () => () => {}, // not using jest.fn to avoid the overhead
};
