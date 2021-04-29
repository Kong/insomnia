import type { Schema } from '@develohpanda/fluent-builder';
import { GrpcStatusEnum, GrpcStatusObject } from '../../../../network/grpc/service-error';

export const grpcStatusObjectSchema: Schema<GrpcStatusObject> = {
  code: () => GrpcStatusEnum.OK,
  details: () => 'details',
  metadata: () => ({}),
};
