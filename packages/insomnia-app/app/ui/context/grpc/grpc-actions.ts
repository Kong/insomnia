import { generateId } from '../../../common/misc';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';
import * as models from '../../../models';
import * as protoLoader from '../../../network/grpc/proto-loader';
import { ValueOf } from 'type-fest';
import { ServiceError, StatusObject } from '@grpc/grpc-js';

export interface GrpcMessage {
  id: string;
  text: string;
  created: number;
}

export const GrpcActionTypeEnum = {
  reset: 'reset',
  clear: 'clear',
  start: 'start',
  stop: 'stop',
  responseMessage: 'responseMessage',
  requestMessage: 'requestStream',
  error: 'error',
  invalidate: 'invalidate',
  invalidateMany: 'invalidateMany',
  loadMethods: 'loadMethods',
  status: 'status',
} as const;

type GrpcActionType = ValueOf<typeof GrpcActionTypeEnum>;

interface Action<T extends GrpcActionType> {
  type: T;
  requestId: string;
}

interface ActionMany<T extends GrpcActionType> {
  type: T;
  requestIds: string[];
}

interface Payload<T> {
  payload: T;
}

type ResetAction = Action<typeof GrpcActionTypeEnum.reset>;

type ClearAction = Action<typeof GrpcActionTypeEnum.clear>;

type StartAction = Action<typeof GrpcActionTypeEnum.start>;

type StopAction = Action<typeof GrpcActionTypeEnum.stop>;

type InvalidateAction = Action<typeof GrpcActionTypeEnum.invalidate>;

export type RequestMessageAction = Action<typeof GrpcActionTypeEnum.requestMessage> & Payload<GrpcMessage>;

export type ResponseMessageAction = Action<typeof GrpcActionTypeEnum.responseMessage> &
  Payload<GrpcMessage>;

export type ErrorAction = Action<typeof GrpcActionTypeEnum.error> & Payload<ServiceError>;

export type StatusAction = Action<typeof GrpcActionTypeEnum.status> & Payload<StatusObject>;

export type LoadMethodsAction = Action<typeof GrpcActionTypeEnum.loadMethods> &
  Payload<GrpcMethodDefinition[]>;

type InvalidateManyAction = ActionMany<typeof GrpcActionTypeEnum.invalidateMany>;

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
  | InvalidateManyAction
  | LoadMethodsAction;

export type GrpcActionMany = InvalidateManyAction;

export type GrpcDispatch = (action?: GrpcAction) => void;

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

const responseMessage = (requestId: string, value: Record<string, any>): ResponseMessageAction => ({
  type: GrpcActionTypeEnum.responseMessage,
  requestId,
  payload: {
    id: generateId(),
    text: JSON.stringify(value),
    created: Date.now(),
  },
});

const requestMessage = (requestId: string, text: string): RequestMessageAction => ({
  type: GrpcActionTypeEnum.requestMessage,
  requestId,
  payload: {
    id: generateId(),
    text,
    created: Date.now(),
  },
});

const error = (requestId: string, error: ServiceError): ErrorAction => ({
  type: GrpcActionTypeEnum.error,
  requestId,
  payload: error,
});

const status = (requestId: string, status: StatusObject): StatusAction => ({
  type: GrpcActionTypeEnum.status,
  requestId,
  payload: status,
});

const clear = (requestId: string): ClearAction => ({
  type: GrpcActionTypeEnum.clear,
  requestId,
});

const invalidate = (requestId: string): InvalidateAction => ({
  type: GrpcActionTypeEnum.invalidate,
  requestId,
});

const invalidateMany = async (protoFileId: string) => {
  const impacted = await models.grpcRequest.findByProtoFileId(protoFileId);

  // skip invalidation if no requests are linked to the proto file
  if (!impacted?.length) {
    return undefined;
  }

  return {
    type: GrpcActionTypeEnum.invalidateMany,
    requestIds: impacted.map(g => g._id),
  } as InvalidateManyAction;
};

const loadMethods = async (requestId: string, protoFileId: string) => {
  console.log(`[gRPC] loading proto file methods pf=${protoFileId}`);
  const protoFile = await models.protoFile.getById(protoFileId);
  const methods = await protoLoader.loadMethods(protoFile);

  return {
    type: GrpcActionTypeEnum.loadMethods,
    requestId,
    payload: methods,
  } as LoadMethodsAction;
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
  invalidateMany,
  loadMethods,
};
