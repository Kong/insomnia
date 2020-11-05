// @flow

import type {
  ErrorAction,
  GrpcAction,
  GrpcMessage,
  RequestMessageAction,
  ResponseMessageAction,
} from './grpc-actions';
import { GrpcActionTypeEnum } from './grpc-actions';
import type { ServiceError } from '../../../network/grpc/service-error';

export type GrpcRequestState = {
  running: boolean,
  requestMessages: Array<GrpcMessage>,
  responseMessages: Array<GrpcMessage>,
  error: ServiceError,
};
export type GrpcState = { [requestId: string]: GrpcRequestState };

const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
  requestMessages: [],
  responseMessages: [],
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
    case GrpcActionTypeEnum.start: {
      return _patch(state, requestId, { ...oldState, running: true });
    }
    case GrpcActionTypeEnum.stop: {
      return _patch(state, requestId, { ...oldState, running: false });
    }
    case GrpcActionTypeEnum.requestMessage: {
      const payload = (action: RequestMessageAction)?.payload;
      return _patch(state, requestId, {
        ...oldState,
        requestMessages: [...oldState.requestMessages, payload.message],
      });
    }
    case GrpcActionTypeEnum.responseMessage: {
      const payload = (action: ResponseMessageAction)?.payload;
      return _patch(state, requestId, {
        ...oldState,
        responseMessages: [...oldState.responseMessages, payload.message],
      });
    }
    case GrpcActionTypeEnum.error: {
      const payload = (action: ErrorAction)?.payload;
      return _patch(state, requestId, { ...oldState, error: payload.error });
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};
