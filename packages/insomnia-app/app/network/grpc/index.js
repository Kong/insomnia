// @flow

import * as grpc from '@grpc/grpc-js';

import * as models from '../../models';
import * as protoLoader from './proto-loader';
import callCache from './call-cache';
import { ResponseCallbacks } from './response-callbacks';

const createClient = (req: GrpcRequest) => {
  const Client = grpc.makeGenericClientConstructor({});
  return new Client(req.url, grpc.credentials.createInsecure());
};

export const sendUnary = async (requestId: string, respond: ResponseCallbacks): Promise<void> => {
  // Load method
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!selectedMethod) {
    respond.sendError(new Error(`The gRPC method ${req.protoMethodName} could not be found`));
    // TODO: sendEnd
    return;
  }

  // Load initial message
  const messageBody = _parseMessage(req, respond.sendError);
  if (!messageBody) {
    return;
  }

  // Create client
  const client = createClient(req);

  // Create callback
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
  // Load method
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!selectedMethod) {
    respond.sendError(new Error(`The gRPC method ${req.protoMethodName} could not be found`));
    // TODO: sendEnd
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
    console.error('[gRPC] Error when writing to stream', err);
  }
};

const _parseMessage = (request: Request, sendError: SendError): Object | undefined => {
  try {
    return JSON.parse(request.body.text || '');
  } catch (e) {
    // TODO: How do we want to handle this case, where the message cannot be parsed?
    //  Currently an error will be shown and the RPC stopped, but we can be less destructive
    sendError(request._id, e);
    // TODO: sendEnd
    return undefined;
  }
};
