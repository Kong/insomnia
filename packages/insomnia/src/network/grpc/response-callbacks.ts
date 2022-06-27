import { ServiceError, StatusObject } from '@grpc/grpc-js';
import { IpcMainEvent } from 'electron';

import { GrpcResponseEventEnum } from '../../common/grpc-events';
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
