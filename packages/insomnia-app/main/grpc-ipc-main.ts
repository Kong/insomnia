import { ipcMain } from 'electron';

import * as grpc from './grpc';
import { GrpcIpcRequestParams } from './grpc/prepare';
import { ResponseCallbacks } from './grpc/response-callbacks';

export const GrpcRequestEventEnum = {
  start: 'GRPC_START',
  sendMessage: 'GRPC_SEND_MESSAGE',
  commit: 'GRPC_COMMIT',
  cancel: 'GRPC_CANCEL',
  cancelMultiple: 'GRPC_CANCEL_MULTIPLE',
} as const;

export function init() {
  ipcMain.on(GrpcRequestEventEnum.start, (e, params: GrpcIpcRequestParams) =>
    grpc.start(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, params: GrpcIpcRequestParams) =>
    // @ts-expect-error -- TSCONVERSION
    grpc.sendMessage(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancelMultiple, (_, requestIdS) =>
    grpc.cancelMultiple(requestIdS),
  );
}
