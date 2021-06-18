import React, { createContext, FunctionComponent, ReactNode, useContext, useEffect, useReducer } from 'react';
import { grpcIpcRenderer } from './grpc-ipc-renderer';
import { findGrpcRequestState, grpcReducer } from './grpc-reducer';
import type { GrpcDispatch } from './grpc-actions';
import type { GrpcRequestState, GrpcState } from './grpc-reducer';

interface Props {
  children: ReactNode;
}

// These should not be exported, so that they are only accessed in a controlled manner
const GrpcStateContext = createContext<GrpcState | undefined>(undefined);
const GrpcDispatchContext = createContext<GrpcDispatch | undefined>(undefined);

export const GrpcProvider: FunctionComponent<Props> = ({ children }) => {
  const [state, dispatch] = useReducer(grpcReducer, {});
  // Only add listeners on mount
  useEffect(() => {
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
  const context = useContext(GrpcStateContext);

  if (context === undefined) {
    throw new Error('useGrpcRequestState must be used within a GrpcProvider');
  }

  if (!requestId) {
    throw new Error('useGrpcRequestState must be invoked with a request id');
  }

  return findGrpcRequestState(context, requestId);
};

export const useGrpcDispatch = (): GrpcDispatch => {
  const context = useContext(GrpcDispatchContext);

  if (context === undefined) {
    throw new Error('useGrpcDispatch must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpc = (requestId: string): [GrpcRequestState, GrpcDispatch] => [
  useGrpcRequestState(requestId),
  useGrpcDispatch(),
];

interface GrpcContextModalWrapperProps {
  children: (dispatch: GrpcDispatch) => ReactNode;
}

export const GrpcDispatchModalWrapper = ({ children }: GrpcContextModalWrapperProps) => {
  const dispatch = useGrpcDispatch();
  return <>{children(dispatch)}</>;
};
