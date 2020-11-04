// @flow
import type { ServiceError } from './service-error';
import { GrpcResponseEventEnum } from '../../common/grpc-events';

interface IResponseCallbacks {
  sendData(requestId: string, val: Object | undefined): void;
  sendError(requestId: string, err: ServiceError): void;
  sendStart(requestId: string): void;
  sendEnd(requestId: string): void;
}

export class ResponseCallbacks implements IResponseCallbacks {
  _event: IpcMainEvent = null;

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
}
