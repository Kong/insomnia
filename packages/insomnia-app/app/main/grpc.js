// @flow

import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';
import { GrpcRequestEventEnum, GrpcResponseEventEnum } from '../common/grpc-events';
import type { ResponseCallbacks, SendData, SendError } from '../network/grpc/response-callbacks';

const createSendData = (e: IpcMainEvent): SendData => (requestId, value) => {
  e.reply(GrpcResponseEventEnum.data, requestId, value);
};

const createSendError = (e: IpcMainEvent): SendError => (requestId, err) => {
  e.reply(GrpcResponseEventEnum.error, requestId, err);
};

const createResponseCallbacks = (e: IpcMainEvent): ResponseCallbacks => ({
  sendError: createSendError(e),
  sendData: createSendData(e),
});

export function init() {
  ipcMain.on(GrpcRequestEventEnum.sendUnary, (e, requestId) =>
    grpc.sendUnary(requestId, createResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.startStream, (e, requestId) =>
    grpc.startClientStreaming(requestId, createResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, requestId) =>
    grpc.sendMessage(requestId, createSendError(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
}
