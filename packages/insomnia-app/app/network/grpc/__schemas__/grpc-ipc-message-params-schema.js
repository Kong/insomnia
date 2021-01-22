// @flow
import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcIpcMessageParams } from '../prepare';

export const grpcIpcMessageParamsSchema: Schema<GrpcIpcMessageParams> = {
  requestId: () => 'gr',
  body: () => ({ text: '{}' }),
};
