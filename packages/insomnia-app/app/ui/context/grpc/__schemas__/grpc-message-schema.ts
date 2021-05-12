import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcMessage } from '../grpc-actions';

export const grpcMessageSchema: Schema<GrpcMessage> = {
  // @ts-expect-error -- TSCONVERSION
  id: () => Math.random(),
  text: () => '{}',
  created: () => Date.now(),
};
