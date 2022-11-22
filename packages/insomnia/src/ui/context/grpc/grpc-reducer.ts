import { MethodDefinition, ServiceError, StatusObject } from '@grpc/grpc-js';

import type {
  GrpcAction,
  GrpcActionMany,
  GrpcMessage,
} from './grpc-actions';

export interface GrpcRequestState {
  running: boolean;
  requestMessages: GrpcMessage[];
  responseMessages: GrpcMessage[];
  status?: StatusObject;
  error?: ServiceError;
  methods: MethodDefinition<any, any>[];
  reloadMethods: boolean;
}

// TODO: delete from here when deleting a request - INS-288
export type GrpcState = Record<string, GrpcRequestState>;

export const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
  methods: [],
  reloadMethods: true,
};

const CLEAR_GRPC_REQUEST_STATE: Partial<GrpcRequestState> = {
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
};

const _patch = (state: GrpcState, requestId: string, requestState: GrpcRequestState): GrpcState => ({
  ...state,
  [requestId]: requestState,
});

export const grpcReducer = (
  state: GrpcState,
  action: GrpcAction | GrpcActionMany,
): GrpcState => {
  if (!action) {
    return state;
  }
  // @ts-expect-error -- TSCONVERSION
  const { requestIds, requestId } = action;
  if (requestIds && action.type === 'invalidateMany') {
    const newStates: GrpcState = {};
    requestIds.forEach((id: string) => {
      const oldState = state[id] || INITIAL_GRPC_REQUEST_STATE;
      const newState: GrpcRequestState = { ...oldState, reloadMethods: true };
      newStates[id] = newState;
    });
    return { ...state, ...newStates };
  }

  const oldState = state[requestId] || INITIAL_GRPC_REQUEST_STATE;

  switch (action.type) {
    case 'reset': {
      return _patch(state, requestId, INITIAL_GRPC_REQUEST_STATE);
    }

    case 'start': {
      return _patch(state, requestId, { ...oldState, running: true });
    }

    case 'stop': {
      return _patch(state, requestId, { ...oldState, running: false });
    }

    case 'requestStream': {
      return _patch(state, requestId, {
        ...oldState,
        requestMessages: [...oldState.requestMessages, action.payload],
      });
    }

    case 'responseMessage': {
      return _patch(state, requestId, {
        ...oldState,
        responseMessages: [...oldState.responseMessages, action.payload],
      });
    }

    case 'error': {
      return _patch(state, requestId, { ...oldState, error: action.payload });
    }

    case 'status': {
      return _patch(state, requestId, { ...oldState, status: action.payload });
    }

    case 'clear': {
      return _patch(state, requestId, { ...oldState, ...CLEAR_GRPC_REQUEST_STATE });
    }

    case 'loadMethods': {
      return _patch(state, requestId, { ...oldState, methods: action.payload, reloadMethods: false });
    }

    case 'invalidate': {
      return _patch(state, requestId, { ...oldState, reloadMethods: true });
    }

    default: {
      throw new Error(`Unhandled single request action type: ${action.type}`);
    }
  }
};
