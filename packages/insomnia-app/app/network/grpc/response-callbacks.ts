import { GrpcResponseEventEnum } from '../../common/grpc-events';
import { IpcMainEvent } from 'electron';
import { ServiceError, StatusObject } from '@grpc/grpc-js';
interface IResponseCallbacks {
  sendData(requestId: string, val: Record<string, any> | undefined): void;
  sendError(requestId: string, err: ServiceError): void;
  sendStart(requestId: string): void;
  sendEnd(requestId: string): void;
  sendStatus(requestId: string, status: StatusObject): void;
}
export class ResponseCallbacks implements IResponseCallbacks {
  _event: IpcMainEvent;

  constructor(e: IpcMainEvent) {
    this._event = e;
  }

  sendData(requestId, val) {
    this._event.reply(GrpcResponseEventEnum.data, requestId, val);
  }

  sendError(requestId, err) {
    this._event.reply(GrpcResponseEventEnum.error, requestId, err);
  }

  sendStart(requestId) {
    this._event.reply(GrpcResponseEventEnum.start, requestId);
  }

  sendEnd(requestId) {
    this._event.reply(GrpcResponseEventEnum.end, requestId);
  }

  sendStatus(requestId, status) {
    this._event.reply(GrpcResponseEventEnum.status, requestId, status);
  }
}
