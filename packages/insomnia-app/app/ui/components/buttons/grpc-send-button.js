// @flow
import React from 'react';
import { useGrpcState } from '../../context/grpc/grpc-context';
import type { GrpcMethodType } from '../../../network/grpc/method';
import type { GrpcRequestEvent } from '../../../common/grpc-events';
import { ipcRenderer } from 'electron';
import { Button } from 'insomnia-components';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';
import { findGrpcRequestState } from '../../context/grpc/grpc-reducer';

type Props = {
  requestId: string,
  methodType: GrpcMethodType | undefined,
};

const GrpcSendButton = ({ requestId, methodType }: Props) => {
  const sendToGrpcMain = React.useCallback(
    (channel: GrpcRequestEvent) => ipcRenderer.send(channel, requestId),
    [requestId],
  );

  const config = React.useMemo(() => {
    let text = '';
    let onClick = null;
    let disabled = false;

    switch (methodType) {
      case GrpcMethodTypeEnum.unary:
        text = 'Send';
        onClick = () => sendToGrpcMain(GrpcRequestEventEnum.sendUnary);
        break;

      case GrpcMethodTypeEnum.client:
        text = 'Start';
        onClick = () => sendToGrpcMain(GrpcRequestEventEnum.startStream);
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

    return { text, onClick, disabled };
  }, [sendToGrpcMain, methodType]);

  const grpcState = useGrpcState();
  const requestState = findGrpcRequestState(grpcState, requestId);

  if (requestState.running) {
    return <Button onClick={() => sendToGrpcMain(GrpcRequestEventEnum.cancel)}>Cancel</Button>;
  }

  return (
    <Button onClick={config.onClick} disabled={config.disabled}>
      {config.text}
    </Button>
  );
};

export default GrpcSendButton;
