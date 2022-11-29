import type { ValueOf } from 'type-fest';

export const GrpcResponseEventEnum = {
  start: 'GRPC_START',
  data: 'GRPC_DATA',
  error: 'GRPC_ERROR',
  end: 'GRPC_END',
  status: 'GRPC_STATUS',
} as const;

export type GrpcResponseEvent = ValueOf<typeof GrpcResponseEventEnum>;
