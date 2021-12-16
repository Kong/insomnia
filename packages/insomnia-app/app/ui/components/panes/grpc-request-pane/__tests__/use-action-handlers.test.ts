import { createBuilder } from '@develohpanda/fluent-builder';
import { renderHook } from '@testing-library/react-hooks';
import { ipcRenderer as _ipcRenderer } from 'electron';
import { mocked } from 'ts-jest/utils';

import { GrpcRequestEventEnum } from '../../../../../common/ipc-events';
import { grpcIpcMessageParamsSchema } from '../../../../../network/grpc/__schemas__/grpc-ipc-message-params-schema';
import { grpcIpcRequestParamsSchema } from '../../../../../network/grpc/__schemas__/grpc-ipc-request-params-schema';
import { GrpcMethodTypeEnum } from '../../../../../network/grpc/method';
import { prepareGrpcMessage as _prepareGrpcMessage, prepareGrpcRequest as _prepareGrpcRequest } from '../../../../../network/grpc/prepare';
import { GrpcDispatch } from '../../../../context/grpc';
import { GrpcActionTypeEnum } from '../../../../context/grpc/grpc-actions';
import useActionHandlers from '../use-action-handlers';

jest.mock('electron');
jest.mock('../../../../../network/grpc/prepare', () => ({
  prepareGrpcMessage: jest.fn(),
  prepareGrpcRequest: jest.fn(),
}));

// Typed mocks using the mocked utility
const mockGrpcDispatch = mocked<GrpcDispatch>(jest.fn());
const prepareGrpcMessage = mocked(_prepareGrpcMessage);
const prepareGrpcRequest = mocked(_prepareGrpcRequest);
const ipcRenderer = mocked(_ipcRenderer);

// Object builders
const messageParamsBuilder = createBuilder(grpcIpcMessageParamsSchema);
const requestParamsBuilder = createBuilder(grpcIpcRequestParamsSchema);

describe('useActionHandlers', () => {
  it.each([
    GrpcMethodTypeEnum.unary,
    GrpcMethodTypeEnum.client,
    GrpcMethodTypeEnum.server,
    GrpcMethodTypeEnum.bidi,
  ])('should send start: %s', async method => {
    // Arrange
    const requestParams = requestParamsBuilder.build();
    prepareGrpcRequest.mockResolvedValue(requestParams);
    const { result } = renderHook(() => useActionHandlers(requestParams.request._id, 'env', method, mockGrpcDispatch));

    // Act
    await result.current.start();

    // Assert
    expect(prepareGrpcRequest).toHaveBeenCalledWith(requestParams.request._id, 'env', method);
    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.start, requestParams);
    expect(mockGrpcDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: GrpcActionTypeEnum.clear }));
  });

  it('should send stream', async () => {
    // Ararnge
    const messageParams = messageParamsBuilder.build();
    prepareGrpcMessage.mockResolvedValue(messageParams);
    const { result } = renderHook(() => useActionHandlers(messageParams.requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    // Act
    await result.current.stream();

    // Assert
    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.sendMessage, messageParams);
    expect(mockGrpcDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: GrpcActionTypeEnum.requestMessage }));
  });

  it('should send cancel', () => {
    // Arrange
    const requestId = 'req';
    const { result } = renderHook(() => useActionHandlers(requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    // Act
    result.current.cancel();

    // Assert
    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.cancel, requestId);
    expect(mockGrpcDispatch).not.toHaveBeenCalled();
  });

  it('should send commit', () => {
    // Arrange
    const requestId = 'req';
    const { result } = renderHook(() => useActionHandlers(requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    // Act
    result.current.commit();

    // Assert
    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.commit, requestId);
    expect(mockGrpcDispatch).not.toHaveBeenCalled();
  });

  it('should exit if request id is falsey', () => {
    // Arrange
    const { result } = renderHook(() => useActionHandlers('', 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    // Act
    result.current.start();
    result.current.stream();
    result.current.commit();
    result.current.cancel();

    // Assert
    expect(ipcRenderer.send).not.toHaveBeenCalled();
    expect(mockGrpcDispatch).not.toHaveBeenCalled();
  });
});
