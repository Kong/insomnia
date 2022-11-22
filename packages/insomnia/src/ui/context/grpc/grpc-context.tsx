import React, { createContext, FunctionComponent, ReactNode, useContext, useEffect, useReducer } from 'react';

import { GrpcResponseEventEnum } from '../../../common/grpc-events';
import { grpcActions, GrpcDispatch } from './grpc-actions';
import { GrpcRequestState, GrpcState, INITIAL_GRPC_REQUEST_STATE } from './grpc-reducer';
import { grpcReducer } from './grpc-reducer';

interface Props {
  children: ReactNode;
}

// These should not be exported, so that they are only accessed in a controlled manner
const GrpcStateContext = createContext<GrpcState>({});
const GrpcDispatchContext = createContext<GrpcDispatch>(e => e);

export const GrpcProvider: FunctionComponent<Props> = ({ children }) => {
  const [state, dispatch] = useReducer(grpcReducer, {});
  // Only add listeners on mount
  useEffect(() => window.main.on(GrpcResponseEventEnum.start, (_, requestId) => {
    dispatch(grpcActions.start(requestId));
  }), []);
  useEffect(() => window.main.on(GrpcResponseEventEnum.end, (_, requestId) => {
    dispatch(grpcActions.stop(requestId));
  }), []);
  useEffect(() => window.main.on(GrpcResponseEventEnum.data, (_, requestId, val) => {
    dispatch(grpcActions.responseMessage(requestId, val));
  }), []);
  useEffect(() => window.main.on(GrpcResponseEventEnum.error, (_, requestId, err) => {
    dispatch(grpcActions.error(requestId, err));
  }), []);
  useEffect(() => window.main.on(GrpcResponseEventEnum.status, (_, requestId, status) => {
    dispatch(grpcActions.status(requestId, status));
  }), []);
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

  return context[requestId] || INITIAL_GRPC_REQUEST_STATE;
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
