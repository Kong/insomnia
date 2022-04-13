import { ipcMain } from 'electron';

import { start, sendMessage, cancelMultiple, commit, cancel } from './grpc/main';
import { ResponseCallbacks } from './grpc/response-callbacks';
import { BaseModel } from './models';

export interface GrpcRequestBody {
  text?: string;
}

export interface GrpcRequestHeader {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface BaseGrpcRequest {
  name: string;
  url: string;
  description: string;
  protoFileId?: string;
  protoMethodName?: string;
  body: GrpcRequestBody;
  metadata: GrpcRequestHeader[];
  metaSortKey: number;
  isPrivate: boolean;
}

export type GrpcRequest = BaseModel & BaseGrpcRequest;
export type RenderedGrpcRequest = GrpcRequest;
export interface GrpcIpcRequestParams {
  request: RenderedGrpcRequest;
}
export const GrpcRequestEventEnum = {
  start: 'GRPC_START',
  sendMessage: 'GRPC_SEND_MESSAGE',
  commit: 'GRPC_COMMIT',
  cancel: 'GRPC_CANCEL',
  cancelMultiple: 'GRPC_CANCEL_MULTIPLE',
} as const;

export function init() {
  ipcMain.on(GrpcRequestEventEnum.start, (e, params: GrpcIpcRequestParams) =>
    start(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (e, params: GrpcIpcRequestParams) =>
    // @ts-expect-error -- TSCONVERSION
    sendMessage(params, new ResponseCallbacks(e)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => cancel(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancelMultiple, (_, requestIdS) =>
    cancelMultiple(requestIdS),
  );
}
