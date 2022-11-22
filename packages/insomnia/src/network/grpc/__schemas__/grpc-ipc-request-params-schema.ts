import type { Schema } from '@develohpanda/fluent-builder';

import { GrpcIpcRequestParams } from '..';

export const grpcIpcRequestParamsSchema: Schema<GrpcIpcRequestParams> = {
  // @ts-expect-error -- TSCONVERSION
  request: () => ({}),
};
