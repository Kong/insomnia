// @flow
import React from 'react';
import { ipcRenderer } from 'electron';
import { GrpcResponseEventEnum } from '../../common/grpc-events';

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

const _patchState = (state: State, requestId: string, requestState: GrpcRequestState): State => {
  return { ...state, [requestId]: requestState };
};

export const findGrpcRequestState = (state: State, requestId: string): GrpcRequestState => {
  return state[requestId] || INITIAL_GRPC_REQUEST_STATE;
};

const grpcReducer = (state: State, action: Action): State => {
  const requestId = action.requestId;
  const oldState = findGrpcRequestState(state, requestId);

  switch (action.type) {
    case 'start': {
      return _patchState(state, requestId, { ...oldState, running: true });
    }
    case 'stop': {
      return _patchState(state, requestId, { ...oldState, running: false });
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};

export const GrpcProvider = ({ children }: Props) => {
  const [state, dispatch] = React.useReducer(grpcReducer, INITIAL_STATE);

  // Only add listeners on mount
  React.useEffect(() => {
    // TODO: Do we need to clear listeners or will they overwrite?
    ipcRenderer.on(GrpcResponseEventEnum.data, (_, requestId, val) => {
      console.log(val);
      dispatch({ type: 'stop', requestId });
    });

    ipcRenderer.on(GrpcResponseEventEnum.error, (_, requestId, err) => {
      console.error(err);
      dispatch({ type: 'stop', requestId });
    });
  }, []);

  return (
    <GrpcStateContext.Provider value={state}>
      <GrpcDispatchContext.Provider value={dispatch}>{children}</GrpcDispatchContext.Provider>
    </GrpcStateContext.Provider>
  );
};

export const useGrpcState = (): State => {
  const context = React.useContext(GrpcStateContext);

  if (context === undefined) {
    throw new Error('useGrpcState must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpcDispatch = (): Dispatch => {
  const context = React.useContext(GrpcDispatchContext);

  if (context === undefined) {
    throw new Error('useGrpcDispatch must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpc = (): [State, Dispatch] => [useGrpcState(), useGrpcDispatch()];
