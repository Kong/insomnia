import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';

export function init() {
  ipcMain.on('GRPC_START_CLIENT_STREAM', (e, requestId) => grpc.startClientStreaming(requestId));
  ipcMain.on('GRPC_SEND_MESSAGE', (e, requestId) => grpc.sendMessage(requestId));
  ipcMain.on('GRPC_COMMIT', (e, requestId) => grpc.commit(requestId));
  ipcMain.on('GRPC_CANCEL', (e, requestId) => grpc.cancel(requestId));
}
