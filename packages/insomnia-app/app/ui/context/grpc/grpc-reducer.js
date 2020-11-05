// @flow

import type { GrpcAction } from './grpc-actions';
import { GrpcActionTypeEnum } from './grpc-actions';

export type GrpcRequestState = { running: boolean };
export type GrpcState = { [requestId: string]: GrpcRequestState };

const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
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
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};
