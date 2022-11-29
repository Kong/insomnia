import { Call, ServiceError } from '@grpc/grpc-js';
import * as grpc from '@grpc/grpc-js';
import { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';

import { GrpcResponseEventEnum } from '../../common/grpc-events';
import { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import * as models from '../../models';
import { GrpcRequestHeader } from '../../models/grpc-request';
import { getMethodType } from '../../network/grpc/method';
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
  const { protocol, host, href } = new URL(grpcUrl);
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
  const requestId = request._id;
  const metadata = request.metadata;
  protoLoader.getSelectedMethod(request)?.then(method => {
    if (!method) {
      event.reply(GrpcResponseEventEnum.error, requestId, new Error(`The gRPC method ${request.protoMethodName} could not be found`));
      return;
    }
    const methodType = getMethodType(method);
    // Create client
    const { url, enableTls } = parseGrpcUrl(request.url);
    if (!url) {
      event.reply(GrpcResponseEventEnum.error, requestId, new Error('URL not specified'));
      return undefined;
    }
    const credentials = enableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
    console.log(`[gRPC] connecting to url=${url} ${enableTls ? 'with' : 'without'} TLS`);
    // @ts-expect-error -- TSCONVERSION second argument should be provided, send an empty string? Needs testing
    const Client = grpc.makeGenericClientConstructor({});
    const client = new Client(url, credentials);
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
            filterDisabledMetaData(metadata),
            _createUnaryCallback(event, requestId),
          );
          break;
        case 'client':
          call = client.makeClientStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(metadata),
            _createUnaryCallback(event, requestId));
          break;
        case 'server':
          call = client.makeServerStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            messageBody,
            filterDisabledMetaData(metadata),
          );
          _setupServerStreamListeners(event, call, requestId);
          break;
        case 'bidi':
          call = client.makeBidiStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(metadata));
          _setupServerStreamListeners(event, call, requestId);
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
      call.on('status', s => event.reply(GrpcResponseEventEnum.status, requestId, s));
      event.reply(GrpcResponseEventEnum.start, requestId);
      // Save call
      callCache.set(requestId, call);
    } catch (error) {
      // TODO: How do we want to handle this case, where the message cannot be parsed?
      //  Currently an error will be shown, but the stream will not be cancelled.
      event.reply(GrpcResponseEventEnum.error, requestId, error);
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
    event.reply(GrpcResponseEventEnum.error, requestId, error);
  }
};

// @ts-expect-error -- TSCONVERSION only end if the call is ClientWritableStream | ClientDuplexStream
export const commit = (requestId: string): void => callCache.get(requestId)?.end();
export const cancel = (requestId: string): void => callCache.get(requestId)?.cancel();
export const cancelMultiple = (requestIds: string[]): void => requestIds.forEach(cancel);

const _setupServerStreamListeners = (event: IpcMainEvent, call: Call, requestId: string) => {
  call.on('data', data => event.reply(GrpcResponseEventEnum.data, requestId, data));
  call.on('error', (error: ServiceError) => {
    if (error && error.code !== grpc.status.CANCELLED) {
      event.reply(GrpcResponseEventEnum.error, requestId, error);
      // Taken through inspiration from other implementation, needs validation
      if (error.code === grpc.status.UNKNOWN || error.code === grpc.status.UNAVAILABLE) {
        event.reply(GrpcResponseEventEnum.end, requestId);
        callCache.delete(requestId);
      }
    }
  });
  call.on('end', () => {
    event.reply(GrpcResponseEventEnum.end, requestId);
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
    event.reply(GrpcResponseEventEnum.data, requestId, value);
  } else {
    // Don't do anything if cancelled
    // TODO: test with other errors
    if (err.code !== grpc.status.CANCELLED) {
      event.reply(GrpcResponseEventEnum.error, requestId, err);
    }
  }
  event.reply(GrpcResponseEventEnum.end, requestId);
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
): grpc.Metadata => {
  const grpcMetadata = new grpc.Metadata();
  for (const entry of metadata) {
    if (!entry.disabled) {
      grpcMetadata.add(entry.name, entry.value);
    }
  }
  return grpcMetadata;
};
