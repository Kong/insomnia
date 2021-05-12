import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcIpcRequestParams } from '../prepare';

export const grpcIpcRequestParamsSchema: Schema<GrpcIpcRequestParams> = {
  // @ts-expect-error -- TSCONVERSION
  request: () => ({}),
};
