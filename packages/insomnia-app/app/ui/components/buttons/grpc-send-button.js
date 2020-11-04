// @flow
import React from 'react';
import { findGrpcRequestState, useGrpc } from '../../context/grpc-context';
import type { GrpcMethodType } from '../../../network/grpc/method';
import type { GrpcRequestEvent } from '../../../common/grpc-events';
import { ipcRenderer } from 'electron';
import { Button } from 'insomnia-components';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';

type Props = {
  requestId: string,
  methodType: GrpcMethodType | undefined,
};

const GrpcSendButton = ({ requestId, methodType }: Props) => {
  const [grpcState, grpcDispatch] = useGrpc();

  const sendToGrpcMain = React.useCallback(
    (channel: GrpcRequestEvent) => ipcRenderer.send(channel, requestId),
    [requestId],
  );

  const requestState = findGrpcRequestState(grpcState, requestId);

  if (requestState.running) {
    return <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.cancel)}>Cancel</Button>;
  }

  let text = '';
  let event = '';
  let disabled = false;

  switch (methodType) {
    case GrpcMethodTypeEnum.unary:
      text = 'Send';
      event = GrpcRequestEventEnum.sendUnary;
      break;

    case GrpcMethodTypeEnum.client:
      text = 'Send';
      event = GrpcRequestEventEnum.startStream;
      break;

    case GrpcMethodTypeEnum.server:
    case GrpcMethodTypeEnum.bidi:
      text = 'Coming soon';
      disabled = true;
      break;

    default:
      text = 'Send';
      disabled = true;
      break;
  }

  return (
    <Button
      onClick={() => {
        grpcDispatch({ type: 'start', requestId });
        sendToGrpcMain(event);
      }}
      disabled={disabled}>
      {text}
    </Button>
  );
};

export default GrpcSendButton;
