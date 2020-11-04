// @flow
import React from 'react';

type Action = { type: 'start', requestId: string } | { type: 'stop', requestId: string };
type Dispatch = (action: Action) => void;
type GrpcRequestState = { running: boolean };
type State = { [requestId: string]: GrpcRequestState };
type Props = { children: React.ReactNode };

const INITIAL_STATE: State = {};
const INITIAL_GRPC_REQUEST_STATE: GrpcRequestState = {
  running: false,
};

const GrpcStateContext = React.createContext<State | undefined>();
const GrpcDispatchContext = React.createContext<Dispatch | undefined>();

const findRequestState = (state: State, requestId: string) => {
  return state[requestId] || INITIAL_GRPC_REQUEST_STATE;
};

const patchState = (state: State, requestId: string, requestState: GrpcRequestState): State => {
  return { ...state, [requestId]: requestState };
};

const grpcReducer = (state: State, action: Action): State => {
  const requestId = action.requestId;
  const oldState = findRequestState(state, requestId);

  switch (action.type) {
    case 'start': {
      return patchState(state, requestId, { ...oldState, running: true });
    }
    case 'stop': {
      return patchState(state, requestId, { ...oldState, running: false });
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};

const GrpcProvider = ({ children }: Props) => {
  const [state, dispatch] = React.useReducer(grpcReducer, INITIAL_STATE);

  return (
    <GrpcStateContext.Provider value={state}>
      <GrpcDispatchContext.Provider value={dispatch}>{children}</GrpcDispatchContext.Provider>
    </GrpcStateContext.Provider>
  );
};

const useGrpcState = () => {
  const context = React.useContext(GrpcStateContext);

  if (context === undefined) {
    throw new Error('useGrpcState must be used within a GrpcProvider');
  }

  return context;
};

const useGrpcDispatch = () => {
  const context = React.useContext(GrpcDispatchContext);

  if (context === undefined) {
    throw new Error('useGrpcDispatch must be used within a GrpcProvider');
  }

  return context;
};

const useGrpc = () => [useGrpcState(), useGrpcDispatch()];

export { GrpcProvider, useGrpc, useGrpcState, useGrpcDispatch };
