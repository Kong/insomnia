import { createBuilder } from '@develohpanda/fluent-builder';
import { renderHook } from '@testing-library/react-hooks';
import { ipcRenderer } from 'electron';
import { mocked } from 'ts-jest/utils';
import { GrpcRequestEventEnum } from '../../../../../common/ipc-events';
import { GrpcMethodTypeEnum } from '../../../../../network/grpc/method';
import { prepareGrpcMessage as _prepareGrpcMessage, prepareGrpcRequest as _prepareGrpcRequest } from '../../../../../network/grpc/prepare';
import { grpcIpcMessageParamsSchema } from '../../../../../network/grpc/__schemas__/grpc-ipc-message-params-schema';
import { grpcIpcRequestParamsSchema } from '../../../../../network/grpc/__schemas__/grpc-ipc-request-params-schema';

import { GrpcDispatch } from '../../../../context/grpc';
import { GrpcActionTypeEnum } from '../../../../context/grpc/grpc-actions';
import useActionHandlers from '../use-action-handlers';

jest.mock('electron');
jest.mock('../../../../../network/grpc/prepare', () => {
  const module = {
    prepareGrpcMessage: jest.fn(),
    prepareGrpcRequest: jest.fn(),
  };

  return module;
})

const mockGrpcDispatch = mocked<GrpcDispatch>(jest.fn());
const prepareGrpcMessage = mocked(_prepareGrpcMessage);
const prepareGrpcRequest = mocked(_prepareGrpcRequest);

const messageParamsBuilder = createBuilder(grpcIpcMessageParamsSchema);
const requestParamsBuilder = createBuilder(grpcIpcRequestParamsSchema);

describe('useActionHandlers', () => {
  it('should send start', async () => {
    const requestParams = requestParamsBuilder.build();
    
    prepareGrpcRequest.mockResolvedValue(requestParams)
    
    const {result} = renderHook(() => useActionHandlers(requestParams.request._id, 'env', GrpcMethodTypeEnum.unary, mockGrpcDispatch));

    await result.current.start();

    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.start, requestParams);
    expect(mockGrpcDispatch).toHaveBeenCalledWith(expect.objectContaining({type: GrpcActionTypeEnum.clear}));
  });

  it('should send stream', async () => {
    const messageParams = messageParamsBuilder.build();
    
    prepareGrpcMessage.mockResolvedValue(messageParams)
    
    const {result} = renderHook(() => useActionHandlers(messageParams.requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    await result.current.stream();

    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.sendMessage, messageParams);
    expect(mockGrpcDispatch).toHaveBeenCalledWith(expect.objectContaining({type: GrpcActionTypeEnum.requestMessage}));
  });

  it('should send cancel', () => {
    const requestId = 'req';
    const {result} = renderHook(() => useActionHandlers(requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    result.current.cancel();

    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.cancel, requestId);
    expect(mockGrpcDispatch).not.toHaveBeenCalled();
  });

  it('should send commit', () => {
    const requestId = 'req';
    const {result} = renderHook(() => useActionHandlers(requestId, 'env', GrpcMethodTypeEnum.client, mockGrpcDispatch));

    result.current.commit();

    expect(ipcRenderer.send).toHaveBeenCalledWith(GrpcRequestEventEnum.commit, requestId);
    expect(mockGrpcDispatch).not.toHaveBeenCalled();
  });
});
