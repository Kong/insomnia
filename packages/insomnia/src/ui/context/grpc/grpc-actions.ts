import { MethodDefinition, ServiceError, StatusObject } from '@grpc/grpc-js';

import { generateId } from '../../../common/misc';

export interface GrpcMessage {
  id: string;
  text: string;
  created: number;
}

export type GrpcActionType = 'reset' |
  'clear' |
  'start' |
  'stop' |
  'responseMessage' |
  'requestStream' |
  'error' |
  'invalidate' |
  'invalidateMany' |
  'loadMethods' |
  'status';

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

type ResetAction = Action<'reset'>;

type ClearAction = Action<'clear'>;

type StartAction = Action<'start'>;

type StopAction = Action<'stop'>;

type InvalidateAction = Action<'invalidate'>;

export type RequestMessageAction = Action<'requestStream'> & Payload<GrpcMessage>;

export type ResponseMessageAction = Action<'responseMessage'> &
  Payload<GrpcMessage>;

export type ErrorAction = Action<'error'> & Payload<ServiceError>;

export type StatusAction = Action<'status'> & Payload<StatusObject>;

export type LoadMethodsAction = Action<'loadMethods'> &
  Payload<MethodDefinition<any, any>[]>;

type InvalidateManyAction = ActionMany<'invalidateMany'>;

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

export type GrpcDispatch = (action: GrpcAction) => void;

const reset = (requestId: string): ResetAction => ({
  type: 'reset',
  requestId,
});

const start = (requestId: string): StartAction => ({
  type: 'start',
  requestId,
});

const stop = (requestId: string): StopAction => ({
  type: 'stop',
  requestId,
});

const responseMessage = (requestId: string, value: Record<string, any>): ResponseMessageAction => ({
  type: 'responseMessage',
  requestId,
  payload: {
    id: generateId(),
    text: JSON.stringify(value),
    created: Date.now(),
  },
});

const requestStream = (requestId: string, text: string): RequestMessageAction => ({
  type: 'requestStream',
  requestId,
  payload: {
    id: generateId(),
    text,
    created: Date.now(),
  },
});

const error = (requestId: string, error: ServiceError): ErrorAction => ({
  type: 'error',
  requestId,
  payload: error,
});

const status = (requestId: string, status: StatusObject): StatusAction => ({
  type: 'status',
  requestId,
  payload: status,
});

const clear = (requestId: string): ClearAction => ({
  type: 'clear',
  requestId,
});

const invalidate = (requestId: string): InvalidateAction => ({
  type: 'invalidate',
  requestId,
});

const invalidateMany = (requestIds: string[]): InvalidateManyAction => ({
  type: 'invalidateMany',
  requestIds,
});

const loadMethods = (requestId: string, methods: MethodDefinition<any, any>[]): LoadMethodsAction => ({
  type: 'loadMethods',
  requestId,
  payload: methods,
});

export const grpcActions = {
  reset,
  clear,
  start,
  stop,
  responseMessage,
  requestStream,
  error,
  status,
  invalidate,
  invalidateMany,
  loadMethods,
};
