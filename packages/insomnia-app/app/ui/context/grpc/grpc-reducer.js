// @flow

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
import { GrpcActionTypeEnum } from './grpc-actions';
import type { GrpcStatusObject, ServiceError } from '../../../network/grpc/service-error';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';

export type GrpcRequestState = {
  running: boolean,
  requestMessages: Array<GrpcMessage>,
  responseMessages: Array<GrpcMessage>,
  status?: GrpcStatusObject,
  error: ServiceError,
  methods: Array<GrpcMethodDefinition>,
  reloadMethods: boolean,
};

// TODO: delete from here when deleting a request - INS-288
export type GrpcState = { [requestId: string]: GrpcRequestState };

const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
  requestMessages: [],
  responseMessages: [],
  status: undefined,
  error: undefined,
  methods: [],
  reloadMethods: true,
};

const CLEAR_GRPC_REQUEST_STATE: Shape<GrpcRequestState> = {
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

const multiRequestReducer = (state: GrpcState, action: GrpcActionMany): GrpcState => {
  const requestIds = action.requestIds;

  switch (action.type) {
    case GrpcActionTypeEnum.invalidateMany: {
      const newStates = {};
      requestIds.forEach(id => {
        const oldState = findGrpcRequestState(state, id);
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
  const requestId = action.requestId;
  const oldState = findGrpcRequestState(state, requestId);

  switch (action.type) {
    case GrpcActionTypeEnum.reset: {
      return _patch(state, requestId, INITIAL_GRPC_REQUEST_STATE);
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
    case GrpcActionTypeEnum.clear: {
      return _patch(state, requestId, {
        ...oldState,
        ...CLEAR_GRPC_REQUEST_STATE,
      });
    }
    case GrpcActionTypeEnum.loadMethods: {
      const { payload }: LoadMethodsAction = action;
      return _patch(state, requestId, {
        ...oldState,
        methods: payload,
        reloadMethods: false,
      });
    }
    case GrpcActionTypeEnum.invalidate: {
      return _patch(state, requestId, {
        ...oldState,
        reloadMethods: true,
      });
    }
    default: {
      throw new Error(`Unhandled single request action type: ${action.type}`);
    }
  }
};

export const grpcReducer = (
  state: GrpcState,
  action: GrpcAction | GrpcActionMany | undefined,
): GrpcState => {
  if (!action) {
    return state;
  }

  return action.requestIds
    ? multiRequestReducer(state, action)
    : singleRequestReducer(state, action);
};
