import { ValueOf } from 'type-fest';

export const GrpcRequestEventEnum = {
  start: 'GRPC_START',
  sendMessage: 'GRPC_SEND_MESSAGE',
  commit: 'GRPC_COMMIT',
  cancel: 'GRPC_CANCEL',
  cancelMultiple: 'GRPC_CANCEL_MULTIPLE',
} as const;

export type GrpcRequestEvent = ValueOf<typeof GrpcRequestEventEnum>;

export const GrpcResponseEventEnum = {
  start: 'GRPC_START',
  data: 'GRPC_DATA',
  error: 'GRPC_ERROR',
  end: 'GRPC_END',
  status: 'GRPC_STATUS',
} as const;

export type GrpcResponseEvent = ValueOf<typeof GrpcResponseEventEnum>;
