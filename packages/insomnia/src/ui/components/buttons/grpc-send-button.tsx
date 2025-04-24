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
      <Button className="rounded-l-sm px-5" isDisabled>
        Send
      </Button>
    );
  }

  return (
    <Button
      className="ml-1 rounded-l-sm bg-[--color-surprise] px-5 text-[--color-font-surprise] hover:brightness-75 focus:brightness-75"
      onPress={running ? handleCancel : handleStart}
    >
      {running ? 'Cancel' : methodType === 'unary' ? 'Send' : 'Start'}
    </Button>
  );
};
