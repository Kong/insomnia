// @flow

export const GrpcEventEnum = {
  sendUnary: 'GRPC_SEND_UNARY',
  startStream: 'GRPC_START_STREAM',
  sendMessage: 'GRPC_SEND_MESSAGE',
  commit: 'GRPC_COMMIT',
  cancel: 'GRPC_CANCEL',
};

export type GrpcEvent = $Values<typeof GrpcEventEnum>;
