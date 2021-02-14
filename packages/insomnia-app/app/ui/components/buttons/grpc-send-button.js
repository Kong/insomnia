// @flow
import React from 'react';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { Button } from 'insomnia-components';
import { GrpcMethodTypeEnum } from '../../../network/grpc/method';

type Props = {
  running: boolean,
  methodType?: GrpcMethodType,
  handleStart: () => Promise<void>,
  handleCancel: () => void,
};

const buttonProps = {
  className: 'tall',
  size: 'medium',
  variant: 'text',
  radius: '0',
};

const GrpcSendButton = ({ running, methodType, handleStart, handleCancel }: Props) => {
  if (running) {
    return (
      <Button {...buttonProps} onClick={handleCancel}>
        Cancel
      </Button>
    );
  }

  if (!methodType) {
    return (
      <Button {...buttonProps} disabled>
        Send
      </Button>
    );
  }

  return (
    <Button {...buttonProps} onClick={handleStart}>
      {methodType === GrpcMethodTypeEnum.unary ? 'Send' : 'Start'}
    </Button>
  );
};

export default GrpcSendButton;
