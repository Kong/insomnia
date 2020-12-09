// @flow
import React from 'react';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';

type Props = {
  running: boolean,
  methodType?: GrpcMethodType,
  handleStart: () => Promise<void>,
  handleCancel: () => void,
};

const GrpcSendButton = ({ running, methodType, handleStart, handleCancel }: Props) => {
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
