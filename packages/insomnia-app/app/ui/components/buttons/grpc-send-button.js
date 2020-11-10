// @flow
import React from 'react';
import { useGrpc } from '../../context/grpc/grpc-context';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';
import { findGrpcRequestState } from '../../context/grpc/grpc-reducer';
import { useGrpcIpc } from '../panes/use-grpc-ipc';
import grpcActions from '../../context/grpc/grpc-actions';

type Props = {
  requestId: string,
  methodType: GrpcMethodType | undefined,
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
        onClick = () => sendIpc(GrpcRequestEventEnum.startStream);
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
  }, [sendIpc, methodType]);

  const [grpcState, grpcDispatch] = useGrpc();
  const requestState = findGrpcRequestState(grpcState, requestId);

  if (requestState.running) {
    return (
      <button className="urlbar__send-btn" onClick={() => sendIpc(GrpcRequestEventEnum.cancel)}>
        Cancel
      </button>
    );
  }

  return (
    <button
      className="urlbar__send-btn"
      onClick={() => {
        config.onClick();
        grpcDispatch(grpcActions.reset(requestId));
      }}
      disabled={config.disabled}>
      {config.text}
    </button>
  );
};

export default GrpcSendButton;
