// @flow
import React from 'react';
import { createGrpcIpcListeners, destroyGrpcIpcListeners } from './ipc-listeners';
import { grpcReducer } from './grpc-reducer';
import type { GrpcDispatch } from './grpc-actions';
import type { GrpcState } from './grpc-reducer';

type Props = { children: React.ReactNode };

const GrpcStateContext = React.createContext<GrpcState | undefined>();
const GrpcDispatchContext = React.createContext<GrpcDispatch | undefined>();

export const GrpcProvider = ({ children }: Props) => {
  const [state, dispatch] = React.useReducer(grpcReducer, {});

  // Only add listeners on mount
  React.useEffect(() => {
    createGrpcIpcListeners(dispatch);
    return destroyGrpcIpcListeners;
  }, []);

  return (
    <GrpcStateContext.Provider value={state}>
      <GrpcDispatchContext.Provider value={dispatch}>{children}</GrpcDispatchContext.Provider>
    </GrpcStateContext.Provider>
  );
};

export const useGrpcState = (): GrpcState => {
  const context = React.useContext(GrpcStateContext);

  if (context === undefined) {
    throw new Error('useGrpcState must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpcDispatch = (): GrpcDispatch => {
  const context = React.useContext(GrpcDispatchContext);

  if (context === undefined) {
    throw new Error('useGrpcDispatch must be used within a GrpcProvider');
  }

  return context;
};

export const useGrpc = (): [State, GrpcDispatch] => [useGrpcState(), useGrpcDispatch()];
