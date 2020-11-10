// @flow

import type {
  ErrorAction,
  GrpcAction,
  GrpcMessage,
  RequestMessageAction,
  ResponseMessageAction,
  StatusAction,
} from './grpc-actions';
import { GrpcActionTypeEnum } from './grpc-actions';
import type { ServiceError } from '../../../network/grpc/service-error';

export type GrpcRequestState = {
  running: boolean,
  requestMessages: Array<GrpcMessage>,
  responseMessages: Array<GrpcMessage>,
  status?: GrpcStatusObject,
  error: ServiceError,
};
export type GrpcState = { [requestId: string]: GrpcRequestState };

const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
};

const _patch = (state: GrpcState, requestId: string, requestState: GrpcRequestState): State => ({
  ...state,
  [requestId]: requestState,
});

export const findGrpcRequestState = (state: GrpcState, requestId: string): GrpcRequestState => {
  return state[requestId] || INITIAL_GRPC_REQUEST_STATE;
};

export const grpcReducer = (state: GrpcState, action: GrpcAction): GrpcState => {
  const requestId = action.requestId;
  const oldState = findGrpcRequestState(state, requestId);

  switch (action.type) {
    case GrpcActionTypeEnum.reset: {
      return _patch(state, requestId, {
        ...INITIAL_GRPC_REQUEST_STATE,
      });
    }
    case GrpcActionTypeEnum.start: {
      return _patch(state, requestId, {
        ...oldState,
        running: true,
      });
    }
    case GrpcActionTypeEnum.stop: {
      return _patch(state, requestId, { ...oldState, running: false });
    }
    case GrpcActionTypeEnum.requestMessage: {
      const { payload }: RequestMessageAction = action;
      return _patch(state, requestId, {
        ...oldState,
        requestMessages: [...oldState.requestMessages, payload],
      });
    }
    case GrpcActionTypeEnum.responseMessage: {
      const { payload }: ResponseMessageAction = action;
      return _patch(state, requestId, {
        ...oldState,
        responseMessages: [...oldState.responseMessages, payload],
      });
    }
    case GrpcActionTypeEnum.error: {
      const { payload }: ErrorAction = action;
      return _patch(state, requestId, { ...oldState, error: payload });
    }
    case GrpcActionTypeEnum.status: {
      const { payload }: StatusAction = action;
      return _patch(state, requestId, { ...oldState, status: payload });
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};
