import React, { type FunctionComponent } from 'react';
import { Button } from 'react-aria-components';

import type { GrpcMethodType } from '../../../main/ipc/grpc';

interface Props {
  running: boolean;
  methodType?: GrpcMethodType;
  handleStart: () => Promise<void>;
  handleCancel: () => void;
}

export const GrpcSendButton: FunctionComponent<Props> = ({ running, methodType, handleStart, handleCancel }) => {
  if (!methodType) {
    return (
      <Button
        className='px-5 rounded-l-sm'
        isDisabled
      >
        Send
      </Button>
    );
  }

  return (
    <Button
      className='px-5 ml-1 text-[--color-font-surprise] bg-[--color-surprise] hover:brightness-75 focus:brightness-75 rounded-l-sm'
      onPress={running ? handleCancel : handleStart}
    >
      {running ? 'Cancel' : methodType === 'unary' ? 'Send' : 'Start'}
    </Button>
  );
};
