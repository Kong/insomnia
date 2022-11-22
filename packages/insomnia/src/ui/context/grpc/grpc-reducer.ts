import { MethodDefinition, ServiceError, StatusObject } from '@grpc/grpc-js';

import type {
  ErrorAction,
  GrpcAction,
  GrpcActionMany,
  GrpcMessage,
  LoadMethodsAction,
  RequestMessageAction,
  ResponseMessageAction,
  StatusAction,
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

const multiRequestReducer = (state: GrpcState, action: GrpcActionMany): GrpcState => {
  const requestIds = action.requestIds;

  switch (action.type) {
    case 'invalidateMany': {
      const newStates: GrpcState = {};
      requestIds.forEach(id => {
        const oldState = state[id] || INITIAL_GRPC_REQUEST_STATE;
        const newState: GrpcRequestState = { ...oldState, reloadMethods: true };
        newStates[id] = newState;
      });
      return { ...state, ...newStates };
    }

    default: {
      throw new Error(`Unhandled multi request action type: ${action.type}`);
    }
  }
};

const singleRequestReducer = (state: GrpcState, action: GrpcAction): GrpcState => {
  // @ts-expect-error -- TSCONVERSION
  const requestId = action.requestId;
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
      const { payload }: RequestMessageAction = action;
      return _patch(state, requestId, {
        ...oldState,
        requestMessages: [...oldState.requestMessages, payload],
      });
    }

    case 'responseMessage': {
      const { payload }: ResponseMessageAction = action;
      return _patch(state, requestId, {
        ...oldState,
        responseMessages: [...oldState.responseMessages, payload],
      });
    }

    case 'error': {
      const { payload }: ErrorAction = action;
      return _patch(state, requestId, { ...oldState, error: payload });
    }

    case 'status': {
      const { payload }: StatusAction = action;
      return _patch(state, requestId, { ...oldState, status: payload });
    }

    case 'clear': {
      return _patch(state, requestId, { ...oldState, ...CLEAR_GRPC_REQUEST_STATE });
    }

    case 'loadMethods': {
      const { payload }: LoadMethodsAction = action;
      return _patch(state, requestId, { ...oldState, methods: payload, reloadMethods: false });
    }

    case 'invalidate': {
      return _patch(state, requestId, { ...oldState, reloadMethods: true });
    }

    default: {
      throw new Error(`Unhandled single request action type: ${action.type}`);
    }
  }
};

export const grpcReducer = (
  state: GrpcState,
  action: GrpcAction | GrpcActionMany,
): GrpcState => {
  if (!action) {
    return state;
  }

  // @ts-expect-error -- TSCONVERSION
  return action.requestIds
    // @ts-expect-error -- TSCONVERSION
    ? multiRequestReducer(state, action)
    : singleRequestReducer(state, action);
};
