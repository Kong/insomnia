import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { GrpcSendButton } from '../grpc-send-button';

describe('<GrpcSendButton />', () => {
  it('should render as disabled if no method is selected', () => {
    const { getByRole } = render(
      <GrpcSendButton
        running={false}
        handleStart={vi.fn()}
        handleCancel={vi.fn()}
        methodType={undefined}
      />,
    );
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Send');
  });

  it('should render cancel button if running', () => {
    const handleCancel = vi.fn();
    const { getByRole } = render(
      <GrpcSendButton
        running={true}
        handleStart={vi.fn()}
        handleCancel={handleCancel}
        methodType={'unary'}
      />,
    );
    const button = getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Cancel');
    fireEvent.click(button);
    expect(handleCancel).toHaveBeenCalled();
  });

  it('should render send button if unary RPC', () => {
    const handleSend = vi.fn();
    const { getByRole } = render(
      <GrpcSendButton
        running={false}
        handleStart={handleSend()}
        handleCancel={vi.fn()}
        methodType={'unary'}
      />,
    );
    const button = getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Send');
    fireEvent.click(button);
    expect(handleSend).toHaveBeenCalled();
  });

  it.each(['bidi', 'server', 'client'])(
    'should render start button if streaming RPC: %s',
    type => {
      const handleSend = vi.fn();
      const { getByRole } = render(
        <GrpcSendButton
          running={false}
          handleStart={handleSend()}
          handleCancel={vi.fn()}
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
