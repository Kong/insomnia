import React, { FunctionComponent } from 'react';

import { GrpcMethodType } from '../../../main/ipc/grpc';
import { Button, ButtonProps } from '../themed-button';

interface Props {
  running: boolean;
  methodType?: GrpcMethodType;
  handleStart: () => Promise<void>;
  handleCancel: () => void;
}

const buttonProps: ButtonProps = {
  className: 'tall',
  bg: 'surprise',
  size: 'medium',
  variant: 'contained',
  radius: '0',
};

export const GrpcSendButton: FunctionComponent<Props> = ({ running, methodType, handleStart, handleCancel }) => {
  if (running) {
    return (
      <Button
        style={{
          borderRadius: 'var(--radius-sm)',
        }}
        {...buttonProps}
        onClick={handleCancel}
      >
        Cancel
      </Button>
    );
  }

  if (!methodType) {
    return (
      <Button
        style={{
          borderRadius: 'var(--radius-sm)',
        }}
        {...buttonProps}
        disabled
      >
        Send
      </Button>
    );
  }

  return (
    <Button
      style={{
        borderRadius: 'var(--radius-sm)',
      }}
      {...buttonProps}
      onClick={handleStart}
    >
      {methodType === 'unary' ? 'Send' : 'Start'}
    </Button>
  );
};
