import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';
import { GrpcEventEnum } from '../common/grpc-events';

export function init() {
  ipcMain.on(GrpcEventEnum.sendUnary, (_, requestId) => grpc.sendUnary(requestId));
  ipcMain.on(GrpcEventEnum.startStream, (_, requestId) => grpc.startClientStreaming(requestId));
  ipcMain.on(GrpcEventEnum.sendMessage, (_, requestId) => grpc.sendMessage(requestId));
  ipcMain.on(GrpcEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
}
