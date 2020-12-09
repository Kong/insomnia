// @flow

import * as grpc from '../network/grpc';
import { ipcMain } from 'electron';
import { GrpcRequestEventEnum } from '../common/grpc-events';
import { ResponseCallbacks } from '../network/grpc/response-callbacks';
import type { GrpcIpcRequestParams } from '../ui/context/grpc/prepare';

export function init() {
  ipcMain.on(GrpcRequestEventEnum.start, (e, params: GrpcIpcRequestParams) =>
    grpc.start(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, params: GrpcIpcRequestParams) =>
    grpc.sendMessage(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancelMultiple, (_, requestIdS) =>
    grpc.cancelMultiple(requestIdS),
  );
}
