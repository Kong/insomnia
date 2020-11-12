// @flow

import type { GrpcStatusObject, ServiceError } from '../../../network/grpc/service-error';
import { generateId } from '../../../common/misc';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';
import * as models from '../../../models';
import * as protoLoader from '../../../network/grpc/proto-loader';

export type GrpcMessage = {
  id: string,
  text: string,
  created: number,
};

export const GrpcActionTypeEnum = {
  reset: 'reset',
  clear: 'clear',
  start: 'start',
  stop: 'stop',
  responseMessage: 'responseMessage',
  requestMessage: 'requestStream',
  error: 'error',
  invalidate: 'invalidate',
  loadMethods: 'loadMethods',
};
type GrpcActionType = $Values<typeof GrpcActionTypeEnum>;

type Action<T: GrpcActionType> = {
  type: T,
  requestId: string,
};

type Payload<T> = {
  payload: T,
};

type ResetAction = Action<GrpcActionTypeEnum.reset>;
type ClearAction = Action<GrpcActionTypeEnum.clear>;
type StartAction = Action<GrpcActionTypeEnum.start>;
type StopAction = Action<GrpcActionTypeEnum.stop>;
type InvalidateAction = Action<GrpcActionTypeEnum.invalidate>;
export type RequestMessageAction = Action<GrpcActionTypeEnum.requestMessage> & Payload<GrpcMessage>;
export type ResponseMessageAction = Action<GrpcActionTypeEnum.responseMessage> &
  Payload<GrpcMessage>;
export type ErrorAction = Action<GrpcActionTypeEnum.error> & Payload<ServiceError>;
export type StatusAction = Action<GrpcActionTypeEnum.status> & Payload<GrpcStatusObject>;
export type LoadMethodsAction = Action<GrpcActionTypeEnum.loadMethods> &
  Payload<Array<GrpcMethodDefinition>>;

export type GrpcAction =
  | ClearAction
  | ResetAction
  | StartAction
  | StopAction
  | ResponseMessageAction
  | RequestMessageAction
  | ErrorAction
  | StatusAction
  | InvalidateAction
  | LoadMethodsAction;

export type GrpcDispatch = (action: GrpcAction) => void;

const reset = (requestId: string): ResetAction => ({
  type: GrpcActionTypeEnum.reset,
  requestId,
});

const start = (requestId: string): StartAction => ({
  type: GrpcActionTypeEnum.start,
  requestId,
});

const stop = (requestId: string): StopAction => ({
  type: GrpcActionTypeEnum.stop,
  requestId,
});

const responseMessage = (requestId: string, value: Object): ResponseMessageAction => ({
  type: GrpcActionTypeEnum.responseMessage,
  requestId,
  payload: { id: generateId(), text: JSON.stringify(value), created: Date.now() },
});

const requestMessage = (requestId: string, text: string): RequestMessageAction => ({
  type: GrpcActionTypeEnum.requestMessage,
  requestId,
  payload: { id: generateId(), text, created: Date.now() },
});

const error = (requestId: string, error: ServiceError): ErrorAction => ({
  type: GrpcActionTypeEnum.error,
  requestId,
  payload: error,
});

const status = (requestId: string, status: GrpcStatusObject): ErrorAction => ({
  type: GrpcActionTypeEnum.status,
  requestId,
  payload: status,
});

const clear = (dispatch: GrpcDispatch, requestId: string) => {
  dispatch({
    type: GrpcActionTypeEnum.clear,
    requestId,
  });
};

const invalidate = (dispatch: GrpcDispatch, requestId: string) => {
  dispatch({
    type: GrpcActionTypeEnum.invalidate,
    requestId,
  });
};

const loadMethods = async (
  dispatch: GrpcDispatch,
  requestId: string,
  protoFileId: string,
  reloadMethods: boolean,
) => {
  if (!reloadMethods) {
    return;
  }

  console.log(`[gRPC] reloading proto file pf=${protoFileId}`);
  const protoFile = await models.protoFile.getById(protoFileId);
  const methods = await protoLoader.loadMethods(protoFile);

  dispatch({
    type: GrpcActionTypeEnum.loadMethods,
    requestId,
    payload: methods,
  });
};

export const grpcActions = {
  reset,
  clear,
  start,
  stop,
  responseMessage,
  requestMessage,
  error,
  status,
  invalidate,
  loadMethods,
};
