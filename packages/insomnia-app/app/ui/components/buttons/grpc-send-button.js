// @flow
import React from 'react';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';
import { grpcActions, useGrpc, useGrpcIpc } from '../../context/grpc';
import { Button } from 'insomnia-components';

type Props = {
  requestId: string,
  methodType: GrpcMethodType | undefined,
};

const buttonProps = {
  className: 'tall',
  size: 'medium',
  variant: 'text',
  radius: '0',
};

const GrpcSendButton = ({ requestId, methodType }: Props) => {
  const sendIpc = useGrpcIpc(requestId);

  const config = React.useMemo(() => {
    let text = '';
    let onClick = null;
    let disabled = false;

    switch (methodType) {
      case GrpcMethodTypeEnum.unary:
        text = 'Send';
        onClick = () => sendIpc(GrpcRequestEventEnum.sendUnary);
        break;

      case GrpcMethodTypeEnum.client:
        text = 'Start';
        onClick = () => sendIpc(GrpcRequestEventEnum.startClientStream);
        break;

      case GrpcMethodTypeEnum.server:
        text = 'Start';
        onClick = () => sendIpc(GrpcRequestEventEnum.startServerStream);
        break;

      case GrpcMethodTypeEnum.bidi:
        text = 'Start';
        onClick = () => sendIpc(GrpcRequestEventEnum.startBidiStream);
        break;

      default:
        text = 'Send';
        disabled = true;
        break;
    }

    return { text, onClick, disabled };
  }, [sendIpc, methodType]);

  const [{ running }, dispatch] = useGrpc(requestId);

  if (running) {
    return (
      <Button {...buttonProps} onClick={() => sendIpc(GrpcRequestEventEnum.cancel)}>
        Cancel
      </Button>
    );
  }

  return (
    <Button
      {...buttonProps}
      onClick={() => {
        config.onClick();
        dispatch(grpcActions.clear(requestId));
      }}
      disabled={config.disabled}>
      {config.text}
    </Button>
  );
};

export default GrpcSendButton;
