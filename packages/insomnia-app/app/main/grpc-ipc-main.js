// @flow

import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';
import { GrpcRequestEventEnum } from '../common/grpc-events';
import { ResponseCallbacks } from '../network/grpc/response-callbacks';

export function init() {
  ipcMain.on(GrpcRequestEventEnum.sendUnary, (e, requestId) =>
    grpc.sendUnary(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.startStream, (e, requestId) =>
    grpc.startClientStreaming(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, requestId) =>
    grpc.sendMessage(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
}
