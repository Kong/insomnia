// @flow

import * as grpc from '@grpc/grpc-js';

import * as models from '../../models';
import { ensureMethodIs, GrpcMethodTypeEnum } from './method';
import type { ResponseCallbacks, SendError } from './response-callbacks';
import * as protoLoader from './proto-loader';
import callCache from './call-cache';

const createClient = (req: GrpcRequest) => {
  const Client = grpc.makeGenericClientConstructor({});
  return new Client(req.url, grpc.credentials.createInsecure());
};

export const sendUnary = async (requestId: string, respond: ResponseCallbacks): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!ensureMethodIs(GrpcMethodTypeEnum.unary, selectedMethod)) {
    respond.sendError(new Error('bad method')); // fix this wording
    return;
  }

  const messageBody = _parseMessage(req, respond.sendError);

  // What should happen when the body is an empty string?
  if (!messageBody) {
    return;
  }

  // Create client
  const client = createClient(req);

  // Create unary callback
  const callback = _createUnaryCallback(requestId, respond);

  // Make call
  const call = client.makeUnaryRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    messageBody,
    callback,
  );

  // Save call
  callCache.set(requestId, call);
};

export const startClientStreaming = async (
  requestId: string,
  respond: ResponseCallbacks,
): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!ensureMethodIs(GrpcMethodTypeEnum.client, selectedMethod)) {
    respond.sendError(new Error('bad method')); // fix this wording
    return;
  }

  // Create client
  const client = createClient(req);

  // Create callback
  const callback = _createUnaryCallback(requestId, respond);

  // Make call
  const call = client.makeClientStreamRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    callback,
  );

  // Save call
  callCache.set(requestId, call);
};

export const sendMessage = async (requestId: string, sendError: SendError) => {
  const req = await models.grpcRequest.getById(requestId);
  const messageBody = _parseMessage(req, sendError);

  if (!messageBody) {
    return;
  }

  callCache.get(requestId)?.write(messageBody, _streamWriteCallback);
};

export const commit = (requestId: string) => callCache.get(requestId)?.end();

export const cancel = (requestId: string) => callCache.get(requestId)?.cancel();

// This function returns a function
const _createUnaryCallback = (requestId: string, respond: ResponseCallbacks) => (err, value) => {
  if (err) {
    respond.sendError(requestId, err);
  } else {
    respond.sendData(requestId, value);
  }
  callCache.clear(requestId);
};

type WriteCallback = (error: Error | null | undefined) => void;

const _streamWriteCallback: WriteCallback = err => {
  if (err) {
    console.error('[grpc] Error when writing to stream', err);
  }
};

const _parseMessage = (request: Request, sendError: SendError): Object | undefined => {
  try {
    return JSON.parse(request.body.text || '');
  } catch (e) {
    sendError(request._id, e);
    return undefined;
  }
};
