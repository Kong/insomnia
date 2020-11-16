// @flow

import * as grpc from '@grpc/grpc-js';

import * as models from '../../models';
import * as protoLoader from './proto-loader';
import callCache from './call-cache';
import type { ServiceError } from './service-error';
import { GrpcStatusEnum } from './service-error';
import type { Call } from './call-cache';
import parseGrpcUrl from './parse-grpc-url';

const _createClient = (req: GrpcRequest, respond: ResponseCallbacks): Object | undefined => {
  const { url, enableTls } = parseGrpcUrl(req.url);

  if (!url) {
    respond.sendError(req._id, new Error('URL not specified'));
    return undefined;
  }

  const credentials = enableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();

  console.log(`[gRPC] connecting to url=${url} ${enableTls ? 'with' : 'without'} TLS`);
  const Client = grpc.makeGenericClientConstructor({});
  return new Client(url, credentials);
};

export const sendUnary = async (requestId: string, respond: ResponseCallbacks): Promise<void> => {
  // Load method
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!selectedMethod) {
    respond.sendError(requestId, new Error(`Method definition could not be found`));
    return;
  }

  // Load initial message
  const messageBody = _parseMessage(req, respond);
  if (!messageBody) {
    return;
  }

  // Create client
  const client = _createClient(req, respond);
  if (!client) {
    return;
  }

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

  _setupStatusListener(call, requestId, respond);
  respond.sendStart(requestId);

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
    respond.sendError(requestId, new Error(`Method definition could not be found`));
    return;
  }

  // Create client
  const client = _createClient(req, respond);

  if (!client) {
    return;
  }

  // Create callback
  const callback = _createUnaryCallback(requestId, respond);

  // Make call
  const call = client.makeClientStreamRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    callback,
  );

  _setupStatusListener(call, requestId, respond);
  respond.sendStart(requestId);

  // Save call
  callCache.set(requestId, call);
};

export const startServerStreaming = async (
  requestId: string,
  respond: ResponseCallbacks,
): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!selectedMethod) {
    respond.sendError(
      requestId,
      new Error(`The gRPC method ${req.protoMethodName} could not be found`),
    );
    return;
  }

  // Load initial message
  const messageBody = _parseMessage(req, respond);
  if (!messageBody) {
    return;
  }

  // Create client
  const client = _createClient(req, respond);
  if (!client) {
    return;
  }

  // Make call
  const call = client.makeServerStreamRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    messageBody,
  );

  _setupStatusListener(call, requestId, respond);
  _setupServerStreamListeners(call, requestId, respond);

  respond.sendStart(requestId);

  // Save call
  callCache.set(requestId, call);
};

export const startBidiStreaming = async (
  requestId: string,
  respond: ResponseCallbacks,
): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const selectedMethod = await protoLoader.getSelectedMethod(req);

  if (!selectedMethod) {
    respond.sendError(
      requestId,
      new Error(`The gRPC method ${req.protoMethodName} could not be found`),
    );
    return;
  }

  // Create client
  const client = _createClient(req, respond);

  if (!client) {
    return;
  }

  // Make call
  const call = client.makeBidiStreamRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
  );

  _setupStatusListener(call, requestId, respond);
  _setupServerStreamListeners(call, requestId, respond);

  respond.sendStart(requestId);

  // Save call
  callCache.set(requestId, call);
};

export const sendMessage = async (requestId: string, respond: ResponseCallbacks) => {
  const req = await models.grpcRequest.getById(requestId);
  const messageBody = _parseMessage(req, respond);

  if (!messageBody) {
    return;
  }

  callCache.get(requestId)?.write(messageBody, _streamWriteCallback);
};

export const commit = (requestId: string) => callCache.get(requestId)?.end();

export const cancel = (requestId: string) => callCache.get(requestId)?.cancel();

export const cancelMultiple = (requestIds: Array<string>) => requestIds.forEach(cancel);

const _setupStatusListener = (call: Call, requestId: string, respond: ResponseCallbacks) => {
  call.on('status', s => respond.sendStatus(requestId, s));
};

const _setupServerStreamListeners = (call: Call, requestId: string, respond: ResponseCallbacks) => {
  call.on('data', data => respond.sendData(requestId, data));

  call.on('error', (error: ServiceError) => {
    if (error?.code !== GrpcStatusEnum.CANCELLED) {
      respond.sendError(requestId, error);

      // Taken through inspiration from other implementation, needs validation
      if (error.code === GrpcStatusEnum.UNKNOWN || error.code === GrpcStatusEnum.UNAVAILABLE) {
        respond.sendEnd(requestId);
      }
    }
  });
  call.on('end', () => respond.sendEnd(requestId));
};

// This function returns a function
const _createUnaryCallback = (requestId: string, respond: ResponseCallbacks) => (
  err: ServiceError,
  value: Object,
) => {
  if (err) {
    // Don't do anything if cancelled
    // TODO: test with other errors
    if (err.code !== GrpcStatusEnum.CANCELLED) {
      respond.sendError(requestId, err);
    }
  } else {
    respond.sendData(requestId, value);
  }
  respond.sendEnd(requestId);
  callCache.clear(requestId);
};

type WriteCallback = (error: Error | null | undefined) => void;

const _streamWriteCallback: WriteCallback = err => {
  if (err) {
    console.error('[gRPC] Error when writing to stream', err);
  }
};

const _parseMessage = (request: Request, respond: ResponseCallbacks): Object | undefined => {
  try {
    return JSON.parse(request.body.text || '');
  } catch (e) {
    // TODO: How do we want to handle this case, where the message cannot be parsed?
    //  Currently an error will be shown, but the stream will not be cancelled.
    respond.sendError(request._id, e);
    return undefined;
  }
};
