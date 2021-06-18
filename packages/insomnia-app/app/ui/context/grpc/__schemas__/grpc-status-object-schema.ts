import type { Schema } from '@develohpanda/fluent-builder';
import { StatusObject, status } from '@grpc/grpc-js';

export const grpcStatusObjectSchema: Schema<StatusObject> = {
  code: () => status.OK,
  details: () => 'details',
  // @ts-expect-error -- TSCONVERSION need a schema for metadata
  metadata: () => ({}),
};
