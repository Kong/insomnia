import { Call, ServiceError, StatusObject } from '@grpc/grpc-js';
import { credentials, makeGenericClientConstructor, Metadata, status } from '@grpc/grpc-js';
import { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';
import { parse as urlParse } from 'url';

import { getMethodType } from '../../common/grpc-paths';
import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import * as models from '../../models';
import type { GrpcRequestHeader } from '../../models/grpc-request';
import * as protoLoader from '../../network/grpc/proto-loader';
import { SegmentEvent, trackSegmentEvent } from '../../ui/analytics';

const callCache = new Map<string, Call>();
export interface GrpcIpcRequestParams {
  request: RenderedGrpcRequest;
}

export interface GrpcIpcMessageParams {
  requestId: string;
  body: RenderedGrpcRequestBody;
}
export interface gRPCBridgeAPI {
  start: (options: GrpcIpcRequestParams) => void;
  sendMessage: (options: GrpcIpcMessageParams) => void;
  commit: typeof commit;
  cancel: typeof cancel;
  cancelMultiple: typeof cancelMultiple;
}
export function registergRPCHandlers() {
  ipcMain.on('grpc.start', start);
  ipcMain.on('grpc.sendMessage', sendMessage);
  ipcMain.on('grpc.commit', (_, requestId) => commit(requestId));
  ipcMain.on('grpc.cancel', (_, requestId) => cancel(requestId));
  ipcMain.on('grpc.cancelMultiple', (_, requestIds) => cancelMultiple(requestIds));
}

export const parseGrpcUrl = (grpcUrl: string) => {
  const { protocol, host, href } = urlParse(grpcUrl?.toLowerCase() || '');
  if (protocol === 'grpcs:') {
    return { url: host, enableTls: true };
  }
  if (protocol === 'grpc:') {
    return { url: host, enableTls: false };
  }
  return { url: href, enableTls: false };
};

export const start = (
  event: IpcMainEvent,
  { request }: GrpcIpcRequestParams,
) => {
  protoLoader.getSelectedMethod(request)?.then(method => {
    if (!method) {
      event.reply('grpc.error', request._id, new Error(`The gRPC method ${request.protoMethodName} could not be found`));
      return;
    }
    const methodType = getMethodType(method);
    // Create client
    const { url, enableTls } = parseGrpcUrl(request.url);
    if (!url) {
      event.reply('grpc.error', request._id, new Error('URL not specified'));
      return undefined;
    }
    console.log(`[gRPC] connecting to url=${url} ${enableTls ? 'with' : 'without'} TLS`);
    // @ts-expect-error -- TSCONVERSION second argument should be provided, send an empty string? Needs testing
    const Client = makeGenericClientConstructor({});
    const client = new Client(url, enableTls ? credentials.createSsl() : credentials.createInsecure());
    if (!client) {
      return;
    }

    let call;
    try {
      const messageBody = JSON.parse(request.body.text || '');
      switch (methodType) {
        case 'unary':
          call = client.makeUnaryRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            messageBody,
            filterDisabledMetaData(request.metadata),
            _createUnaryCallback(event, request._id),
          );
          break;
        case 'client':
          call = client.makeClientStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(request.metadata),
            _createUnaryCallback(event, request._id));
          break;
        case 'server':
          call = client.makeServerStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            messageBody,
            filterDisabledMetaData(request.metadata),
          );
          _setupServerStreamListeners(event, call, request._id);
          break;
        case 'bidi':
          call = client.makeBidiStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(request.metadata));
          _setupServerStreamListeners(event, call, request._id);
          break;
        default:
          return;
      }
      if (!call) {
        return;
      }
      // Update request stats
      models.stats.incrementExecutedRequests();
      trackSegmentEvent(SegmentEvent.requestExecute);

      call.on('status', (status: StatusObject) => event.reply('grpc.status', request._id, status));
      event.reply('grpc.start', request._id);
      // Save call
      callCache.set(request._id, call);
    } catch (error) {
      // TODO: How do we want to handle this case, where the message cannot be parsed?
      //  Currently an error will be shown, but the stream will not be cancelled.
      event.reply('grpc.error', request._id, error);
    }
    return;
  });
};

export const sendMessage = (
  event: IpcMainEvent,
  { body, requestId }: GrpcIpcMessageParams,
) => {
  try {
    const messageBody = JSON.parse(body.text || '');
    // HACK BUT DO NOT REMOVE
    // this must happen in the next tick otherwise the stream does not flush correctly
    // Try removing it and using a bidi RPC and notice messages don't send consistently
    process.nextTick(() => {
      // @ts-expect-error -- TSCONVERSION only write if the call is ClientWritableStream | ClientDuplexStream
      callCache.get(requestId)?.write(messageBody, err => {
        if (err) {
          console.error('[gRPC] Error when writing to stream', err);
        }
      });
    });
  } catch (error) {
    event.reply('grpc.error', requestId, error);
  }
};

// @ts-expect-error -- TSCONVERSION only end if the call is ClientWritableStream | ClientDuplexStream
export const commit = (requestId: string): void => callCache.get(requestId)?.end();
export const cancel = (requestId: string): void => callCache.get(requestId)?.cancel();
export const cancelMultiple = (requestIds: string[]): void => requestIds.forEach(cancel);

const _setupServerStreamListeners = (event: IpcMainEvent, call: Call, requestId: string) => {
  call.on('data', data => event.reply('grpc.data', requestId, data));
  call.on('error', (error: ServiceError) => {
    if (error && error.code !== status.CANCELLED) {
      event.reply('grpc.error', requestId, error);
      // Taken through inspiration from other implementation, needs validation
      if (error.code === status.UNKNOWN || error.code === status.UNAVAILABLE) {
        event.reply('grpc.end', requestId);
        callCache.delete(requestId);
      }
    }
  });
  call.on('end', () => {
    event.reply('grpc.end', requestId);
    // @ts-expect-error -- TSCONVERSION channel not found in call
    const channel = callCache.get(requestId)?.call?.call.channel;
    if (channel) {
      channel.close();
    } else {
      console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
    }
    callCache.delete(requestId);
  });
};

const _createUnaryCallback = (event: IpcMainEvent, requestId: string) => (err: ServiceError | null, value?: Record<string, any>) => {
  if (!err) {
    event.reply('grpc.data', requestId, value);
  } else {
    // Don't do anything if cancelled
    // TODO: test with other errors
    if (err.code !== status.CANCELLED) {
      event.reply('grpc.error', requestId, err);
    }
  }
  event.reply('grpc.end', requestId);
  // @ts-expect-error -- TSCONVERSION channel not found in call
  const channel = callCache.get(requestId)?.call?.call.channel;
  if (channel) {
    channel.close();
  } else {
    console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
  }
  callCache.delete(requestId);
};

const filterDisabledMetaData = (
  metadata: GrpcRequestHeader[],
): Metadata => {
  const grpcMetadata = new Metadata();
  for (const entry of metadata) {
    if (!entry.disabled) {
      grpcMetadata.add(entry.name, entry.value);
    }
  }
  return grpcMetadata;
};

export type GrpcMethodType = 'unary' | 'server' | 'client' | 'bidi';
