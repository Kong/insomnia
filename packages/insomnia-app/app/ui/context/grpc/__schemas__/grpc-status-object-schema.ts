import type { Schema } from '@develohpanda/fluent-builder';
import { StatusObject } from '@grpc/grpc-js';
import { GrpcStatusEnum } from '../../../../network/grpc/service-error';

export const grpcStatusObjectSchema: Schema<StatusObject> = {
  code: () => GrpcStatusEnum.OK,
  details: () => 'details',
  // @ts-expect-error need a schema for metadata
  metadata: () => ({}),
};
