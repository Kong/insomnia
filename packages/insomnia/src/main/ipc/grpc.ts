import { ServiceError, StatusObject } from '@grpc/grpc-js';
import { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';

import { GrpcResponseEventEnum } from '../../common/grpc-events';
import { GrpcRequestEventEnum } from '../../common/grpc-events';
import * as grpc from '../../network/grpc';
import { GrpcIpcRequestParams } from '../../network/grpc';

export function registergRPCHandlers() {
  ipcMain.on(GrpcRequestEventEnum.start, (event, params: GrpcIpcRequestParams) =>
    grpc.start(params, new ResponseCallbacks(event)),
  );
  ipcMain.on(GrpcRequestEventEnum.sendMessage, (event, params: GrpcIpcRequestParams) =>
    // @ts-expect-error -- TSCONVERSION
    grpc.sendMessage(params, new ResponseCallbacks(event)),
  );
  ipcMain.on(GrpcRequestEventEnum.commit, (_, requestId) => grpc.commit(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancel, (_, requestId) => grpc.cancel(requestId));
  ipcMain.on(GrpcRequestEventEnum.cancelMultiple, (_, requestIdS) =>
    grpc.cancelMultiple(requestIdS),
  );
}
interface IResponseCallbacks {
  sendData(requestId: string, val: Record<string, any> | undefined): void;
  sendError(requestId: string, err: ServiceError): void;
  sendStart(requestId: string): void;
  sendEnd(requestId: string): void;
  sendStatus(requestId: string, status: StatusObject): void;
}
export class ResponseCallbacks implements IResponseCallbacks {
  _event: IpcMainEvent;
  constructor(event: IpcMainEvent) {
    this._event = event;
  }
  sendData(requestId: string, val: Record<string, any>) {
    this._event.reply(GrpcResponseEventEnum.data, requestId, val);
  }
  sendError(requestId: string, err: Error) {
    this._event.reply(GrpcResponseEventEnum.error, requestId, err);
  }
  sendStart(requestId: string) {
    this._event.reply(GrpcResponseEventEnum.start, requestId);
  }
  sendEnd(requestId: string) {
    this._event.reply(GrpcResponseEventEnum.end, requestId);
  }
  sendStatus(requestId: string, status: StatusObject) {
    this._event.reply(GrpcResponseEventEnum.status, requestId, status);
  }
}
