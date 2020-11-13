// @flow
import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcMessage } from '../grpc-actions';

export const grpcMessageSchema: Schema<GrpcMessage> = {
  id: () => Math.random(),
  text: () => '{}',
  created: () => Date.now(),
};
