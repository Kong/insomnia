// @flow

import * as grpc from '../network/grpc';
import { BrowserWindow, ipcMain } from 'electron';
import { GrpcRequestEventEnum, GrpcResponseEventEnum } from '../common/grpc-events';
import type { ResponseCallbacks, SendData, SendError } from '../network/grpc/response-callbacks';

const sendData: SendData = (requestId, value) => {
  const windows = BrowserWindow.getAllWindows();
  for (const w of windows) {
    w.send(GrpcResponseEventEnum.data, requestId, value);
  }
};

const sendError: SendError = (requestId, err) => {
  const windows = BrowserWindow.getAllWindows();
  for (const w of windows) {
    w.send(GrpcResponseEventEnum.error, requestId, err);
  }
};

export function init() {
  const callbacks: ResponseCallbacks = {
    sendData,
    sendError,
  };

  ipcMain.on(GrpcRequestEventEnum.sendUnary, (_, requestId) => grpc.sendUnary(requestId));
  ipcMain.on(GrpcRequestEventEnum.startStream, (_, requestId) =>
    grpc.startClientStreaming(requestId, callbacks),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (_, requestId) => grpc.sendMessage(requestId));
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
}
