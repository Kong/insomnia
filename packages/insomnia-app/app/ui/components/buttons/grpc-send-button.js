// @flow
import React from 'react';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';
import { useGrpcRequestState } from '../../context/grpc';

type Props = {
  requestId: string,
  methodType?: GrpcMethodType,
  handleStart: () => void,
  handleCancel: () => void,
};

const GrpcSendButton = ({ requestId, methodType, handleStart, handleCancel }: Props) => {
  const { running } = useGrpcRequestState(requestId);

  if (running) {
    return (
      <button className="urlbar__send-btn" onClick={handleCancel}>
        Cancel
      </button>
    );
  }

  if (!methodType) {
    return (
      <button className="urlbar__send-btn" disabled>
        Send
      </button>
    );
  }

  return (
    <button className="urlbar__send-btn" onClick={handleStart}>
      {methodType === GrpcMethodTypeEnum.unary ? 'Send' : 'Start'}
    </button>
  );
};

export default GrpcSendButton;
