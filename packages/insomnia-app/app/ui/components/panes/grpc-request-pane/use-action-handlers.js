// @flow
import { useCallback } from 'react';
import type { GrpcMethodType } from '../../../../network/grpc/method';
import { GrpcRequestEventEnum } from '../../../../common/grpc-events';
import { ipcRenderer } from 'electron';
import { grpcActions } from '../../../context/grpc';
import { prepareGrpcMessage, prepareGrpcRequest } from '../../../../network/grpc/prepare';

const _sendStart = async (
  reqId: string,
  envId: string,
  type: GrpcMethodType,
  dispatch: GrpcDispatch,
) => {
  if (!reqId) {
    return;
  }
  const preparedRequest = await prepareGrpcRequest(reqId, envId, type);
  ipcRenderer.send(GrpcRequestEventEnum.start, preparedRequest);
  dispatch(grpcActions.clear(reqId));
};

const _sendCancel = (reqId: string) => {
  if (!reqId) {
    return;
  }
  ipcRenderer.send(GrpcRequestEventEnum.cancel, reqId);
};

const _sendMessage = async (reqId: string, envId: string, dispatch: GrpcDispatch) => {
  if (!reqId) {
    return;
  }
  const preparedMessage = await prepareGrpcMessage(reqId, envId);
  ipcRenderer.send(GrpcRequestEventEnum.sendMessage, preparedMessage);
  dispatch(grpcActions.requestMessage(reqId, preparedMessage.body.text));
};

const _sendCommit = (reqId: string) => {
  if (!reqId) {
    return;
  }
  ipcRenderer.send(GrpcRequestEventEnum.commit, reqId);
};

type ActionHandlers = {
  start: () => Promise<void>,
  stream: () => Promise<void>,
  cancel: () => void,
  commit: () => void,
};

const useActionHandlers = (
  reqId: string,
  envId: string,
  type: GrpcMethodType,
  dispatch: GrpcDispatch,
): ActionHandlers => ({
  start: useCallback(() => _sendStart(reqId, envId, type, dispatch), [
    envId,
    reqId,
    type,
    dispatch,
  ]),
  cancel: useCallback(() => _sendCancel(reqId), [reqId]),
  stream: useCallback(() => _sendMessage(reqId, envId, dispatch), [dispatch, envId, reqId]),
  commit: useCallback(() => _sendCommit(reqId), [reqId]),
});

export default useActionHandlers;
