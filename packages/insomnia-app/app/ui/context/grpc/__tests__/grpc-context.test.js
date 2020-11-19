// @flow
import React from 'react';
import { render } from '@testing-library/react';
import { GrpcProvider } from '../grpc-context';

import { grpcIpcRenderer } from '../grpc-ipc-renderer';

jest.mock('../grpc-ipc-renderer', () => ({
  grpcIpcRenderer: {
    init: jest.fn(),
    destroy: jest.fn(),
  },
}));

describe('<GrpcProvider />', () => {
  it('should initialize and destroy grpc-ipc-renderer', async () => {
    const { unmount } = render(<GrpcProvider>test</GrpcProvider>);

    expect(grpcIpcRenderer.init).toHaveBeenCalledTimes(1);

    unmount();

    expect(grpcIpcRenderer.destroy).toHaveBeenCalledTimes(1);
  });
});
