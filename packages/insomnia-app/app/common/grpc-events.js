// @flow

export const GrpcRequestEventEnum = {
  sendUnary: 'GRPC_SEND_UNARY',
  startClientStream: 'GRPC_START_CLIENT_STREAM',
  startServerStream: 'GRPC_START_SERVER_STREAM',
  startBidiStream: 'GRPC_START_BIDI_STREAM',
  sendMessage: 'GRPC_SEND_MESSAGE',
  commit: 'GRPC_COMMIT',
  cancel: 'GRPC_CANCEL',
  cancelMultiple: 'GRPC_CANCEL_MULTIPLE',
};
export type GrpcRequestEvent = $Values<typeof GrpcRequestEventEnum>;

export const GrpcResponseEventEnum = {
  start: 'GRPC_START',
  data: 'GRPC_DATA',
  error: 'GRPC_ERROR',
  end: 'GRPC_END',
  status: 'GRPC_STATUS',
};
export type GrpcResponseEvent = $Values<typeof GrpcResponseEventEnum>;
