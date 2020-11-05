// @flow

import type { ServiceError } from '../../../network/grpc/service-error';

export type GrpcMessage = {
  text: string,
  created: number,
};

export const GrpcActionTypeEnum = {
  start: 'start',
  stop: 'stop',
  responseMessage: 'responseMessage',
  requestMessage: 'requestStream',
  error: 'error',
};
type GrpcActionType = $Values<typeof GrpcActionTypeEnum>;

type Action<T: GrpcActionType> = {
  type: T,
  requestId: string,
};

type Payload<T> = {
  payload: T,
};

type StartAction = Action<GrpcActionTypeEnum.start>;
type StopAction = Action<GrpcActionTypeEnum.stop>;
export type RequestMessageAction = Action<GrpcActionTypeEnum.requestMessage> &
  Payload<{ message: GrpcMessage }>;
export type ResponseMessageAction = Action<GrpcActionTypeEnum.responseMessage> &
  Payload<{ messages: GrpcMessage }>;
export type ErrorAction = Action<GrpcActionTypeEnum.error> & Payload<{ error: ServiceError }>;

export type GrpcAction =
  | StartAction
  | StopAction
  | ResponseMessageAction
  | RequestMessageAction
  | ErrorAction;

export type GrpcDispatch = (action: GrpcAction) => void;

const start = (requestId: string): StartAction => ({
  type: GrpcActionTypeEnum.start,
  requestId,
});

const stop = (requestId: string): StopAction => ({
  type: GrpcActionTypeEnum.stop,
  requestId,
});

const responseMessage = (
  requestId: string,
  value: Object,
  created: number,
): ResponseMessageAction => ({
  type: GrpcActionTypeEnum.responseMessage,
  requestId,
  payload: { text: JSON.stringify(value), created },
});

const requestMessage = (
  requestId: string,
  text: string,
  created: number,
): RequestMessageAction => ({
  type: GrpcActionTypeEnum.requestMessage,
  requestId,
  payload: { text, created },
});

const error = (requestId: string, error: ServiceError): ErrorAction => ({
  type: GrpcActionTypeEnum.error,
  requestId,
  payload: { error },
});

const grpcActions = { start, stop, responseMessage, requestMessage, error };

export default grpcActions;
