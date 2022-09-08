import classnames from 'classnames';
import React, { FunctionComponent } from 'react';

import { useGrpcRequestState } from '../context/grpc';
import { ReadyState, useWSReadyState } from '../context/websocket-client/use-ws-ready-state';

interface Props {
  className?: string;
  requestId: string;
}

export const GrpcSpinner: FunctionComponent<Props> = ({ className, requestId }) => {
  const { running } = useGrpcRequestState(requestId);
  return running ? <i className={classnames('fa fa-refresh fa-spin', className)} /> : null;
};

export const WebSocketSpinner: FunctionComponent<Props> = ({ className, requestId }) => {
  const readyState = useWSReadyState(requestId);

  if (readyState === ReadyState.OPEN) {
    return <i className={classnames('fa fa-refresh fa-spin', className)} />;
  }
  return null;
};
