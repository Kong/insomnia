import type { Schema } from '@develohpanda/fluent-builder';

import { GrpcIpcMessageParams } from '..';

export const grpcIpcMessageParamsSchema: Schema<GrpcIpcMessageParams> = {
  requestId: () => 'gr',
  body: () => ({
    text: '{}',
  }),
};
