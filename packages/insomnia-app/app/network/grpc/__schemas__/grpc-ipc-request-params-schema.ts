import { createBuilder, Schema } from '@develohpanda/fluent-builder';

import { grpcRequestModelSchema } from '../../../models/__schemas__/model-schemas';
import type { GrpcIpcRequestParams } from '../prepare';

export const grpcIpcRequestParamsSchema: Schema<GrpcIpcRequestParams> = {
  request: () => createBuilder(grpcRequestModelSchema).build(),
};
