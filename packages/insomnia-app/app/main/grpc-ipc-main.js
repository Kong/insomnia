// @flow

import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';
import { GrpcRequestEventEnum } from '../common/grpc-events';
import { ResponseCallbacks } from '../network/grpc/response-callbacks';

export function init() {
  ipcMain.on(GrpcRequestEventEnum.sendUnary, (e, requestId) =>
    grpc.sendUnary(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.startClientStream, (e, requestId) =>
    grpc.startClientStreaming(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.startServerStream, (e, requestId) =>
    grpc.startServerStreaming(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.startBidiStream, (e, requestId) =>
    grpc.startBidiStreaming(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, requestId) =>
    grpc.sendMessage(requestId, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancelMultiple, (_, requestIdS) =>
    grpc.cancelMultiple(requestIdS),
  );
}
