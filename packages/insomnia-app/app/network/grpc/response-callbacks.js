// @flow
import type { ServiceError } from './service-error';

export type SendData = (requestId: string, val: object | undefined) => void;
export type SendError = (requestId: string, err: ServiceError) => void;

export type ResponseCallbacks = {
  sendData: SendData,
  sendError: SendError,
};
