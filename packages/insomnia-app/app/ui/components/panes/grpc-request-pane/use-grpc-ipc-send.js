// @flow
import { useCallback } from 'react';
import type { GrpcMethodType } from '../../../../network/grpc/method';
import { GrpcRequestEventEnum } from '../../../../common/grpc-events';
import { ipcRenderer } from 'electron';
import { grpcActions } from '../../../context/grpc';
import { prepareGrpcMessage, prepareGrpcRequest } from '../../../../network/grpc/prepare';

const _sendStart = (reqId: string, envId: string, type: GrpcMethodType) => async () => {
  if (!reqId) {
    return;
  }
  const preparedRequest = await prepareGrpcRequest(reqId, envId, type);
  ipcRenderer.send(GrpcRequestEventEnum.start, preparedRequest);
};

const _sendCancel = (reqId: string) => () => {
  if (!reqId) {
    return;
  }
  ipcRenderer.send(GrpcRequestEventEnum.cancel, reqId);
};

const _sendMessage = (reqId: string, envId: string, dispatch: GrpcDispatch) => async () => {
  if (!reqId) {
    return;
  }
  const preparedMessage = await prepareGrpcMessage(reqId, envId);
  ipcRenderer.send(GrpcRequestEventEnum.sendMessage, preparedMessage);
  dispatch(grpcActions.requestMessage(reqId, preparedMessage.body.text));
};

const _sendCommit = (reqId: string) => () => {
  if (!reqId) {
    return;
  }
  ipcRenderer.send(GrpcRequestEventEnum.commit, reqId);
};

const useGrpcIpcSend = (
  reqId: string,
  envId: string,
  type: GrpcMethodType,
  dispatch: GrpcDispatch,
) => ({
  handleStart: useCallback(() => _sendStart(reqId, envId, type), [envId, reqId, type]),
  handleCancel: useCallback(() => _sendCancel(reqId), [reqId]),
  handleMessage: useCallback(() => _sendMessage(reqId, envId, dispatch), [dispatch, envId, reqId]),
  handleCommit: useCallback(() => _sendCommit(reqId), [reqId]),
});

export default useGrpcIpcSend;
