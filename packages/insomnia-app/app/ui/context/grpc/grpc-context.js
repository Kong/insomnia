// @flow
import React from 'react';
import { grpcIpcRenderer } from './grpc-ipc-renderer';
import { findGrpcRequestState, grpcReducer } from './grpc-reducer';
import type { GrpcDispatch } from './grpc-actions';
import type { GrpcRequestState, GrpcState } from './grpc-reducer';

type Props = { children: React.ReactNode };

// These should not be exported, so that they are only accessed in a controlled manner
const GrpcStateContext = React.createContext<GrpcState | undefined>();
const GrpcDispatchContext = React.createContext<GrpcDispatch | undefined>();

export const GrpcProvider = ({ children }: Props) => {
  const [state, dispatch] = React.useReducer(grpcReducer, {});

  // Only add listeners on mount
  React.useEffect(() => {
    grpcIpcRenderer.init(dispatch);
    return grpcIpcRenderer.destroy;
  }, []);

  return (
    <GrpcStateContext.Provider value={state}>
      <GrpcDispatchContext.Provider value={dispatch}>{children}</GrpcDispatchContext.Provider>
    </GrpcStateContext.Provider>
  );
};

export const useGrpcRequestState = (requestId: string): GrpcRequestState => {
  const context = React.useContext(GrpcStateContext);

  if (context === undefined) {
    throw new Error('useGrpcRequestState must be used within a GrpcProvider');
  }

  if (!requestId) {
    throw new Error('useGrpcRequestState must be invoked with a request id');
  }

  return findGrpcRequestState(context, requestId);
};

export const useGrpcDispatch = (): GrpcDispatch => {
  const context = React.useContext(GrpcDispatchContext);

  if (context === undefined) {
    throw new Error('useGrpcDispatch must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpc = (requestId: string): [GrpcRequestState, GrpcDispatch] => [
  useGrpcRequestState(requestId),
  useGrpcDispatch(),
];

type GrpcContextModalWrapperProps = {|
  children: (dispatch: GrpcDispatch) => React.Node,
|};

export const GrpcDispatchModalWrapper = ({ children }: GrpcContextModalWrapperProps) => {
  const dispatch = useGrpcDispatch();

  return children(dispatch);
};
