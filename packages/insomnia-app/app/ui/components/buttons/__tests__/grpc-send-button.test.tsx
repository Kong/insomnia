import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import { GrpcMethodTypeEnum } from '../../../../network/grpc/method';
import { GrpcSendButton } from '../grpc-send-button';

describe('<GrpcSendButton />', () => {
  it('should render as disabled if no method is selected', () => {
    const { getByRole } = render(
      <GrpcSendButton
        running={false}
        handleStart={jest.fn()}
        handleCancel={jest.fn()}
        methodType={undefined}
      />,
    );
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Send');
  });

  it('should render cancel button if running', () => {
    const handleCancel = jest.fn();
    const { getByRole } = render(
      <GrpcSendButton
        running={true}
        handleStart={jest.fn()}
        handleCancel={handleCancel}
        methodType={GrpcMethodTypeEnum.unary}
      />,
    );
    const button = getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Cancel');
    fireEvent.click(button);
    expect(handleCancel).toHaveBeenCalled();
  });

  it('should render send button if unary RPC', () => {
    const handleSend = jest.fn();
    const { getByRole } = render(
      <GrpcSendButton
        running={false}
        handleStart={handleSend()}
        handleCancel={jest.fn()}
        methodType={GrpcMethodTypeEnum.unary}
      />,
    );
    const button = getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Send');
    fireEvent.click(button);
    expect(handleSend).toHaveBeenCalled();
  });

  it.each([GrpcMethodTypeEnum.bidi, GrpcMethodTypeEnum.server, GrpcMethodTypeEnum.client])(
    'should render start button if streaming RPC: %s',
    type => {
      const handleSend = jest.fn();
      const { getByRole } = render(
        <GrpcSendButton
          running={false}
          handleStart={handleSend()}
          handleCancel={jest.fn()}
          methodType={type}
        />,
      );
      const button = getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Start');
      fireEvent.click(button);
      expect(handleSend).toHaveBeenCalled();
    },
  );
});
