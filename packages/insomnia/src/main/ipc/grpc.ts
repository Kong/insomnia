import { Call, ServiceError, StatusObject } from '@grpc/grpc-js';
import { MethodDefinition } from '@grpc/grpc-js';
import * as grpc from '@grpc/grpc-js';
import { ServiceClient } from '@grpc/grpc-js/build/src/make-client';
import { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';
import { parse as urlParse } from 'url';

import { GrpcResponseEventEnum } from '../../common/grpc-events';
import { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import * as models from '../../models';
import { GrpcRequest, GrpcRequestHeader } from '../../models/grpc-request';
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

const _makeServerStreamRequest = (
  {
    requestId,
    method: { path, requestSerialize, responseDeserialize },
    client,
    respond,
    metadata,
  }: RequestData,
  messageBody: {},
): Call | undefined => {
  // Load initial message

  const call = client.makeServerStreamRequest(
    path,
    requestSerialize,
    responseDeserialize,
    messageBody,
    filterDisabledMetaData(metadata),
  );

  _setupServerStreamListeners(call, requestId, respond);
  // eslint-disable-next-line consistent-return
  return call;

};

const _makeBidiStreamRequest = ({
  requestId,
  method: { path, requestSerialize, responseDeserialize },
  client,
  respond,
  metadata,
}: RequestData): Call | undefined => {
  const call = client.makeBidiStreamRequest(path, requestSerialize, responseDeserialize, filterDisabledMetaData(metadata));
  _setupServerStreamListeners(call, requestId, respond);
  return call;
};

interface RequestData {
  requestId: string;
  respond: ResponseCallbacks;
  client: ServiceClient;
  method: MethodDefinition<any, any>;
  metadata: GrpcRequestHeader[];
}
export const parseGrpcUrl = (
  grpcUrl?: string,
): {
  url: string;
  enableTls: boolean;
} => {
  const { protocol, host, href } = urlParse(grpcUrl?.toLowerCase() || '');

  switch (protocol) {
    case 'grpcs:':
      return {
        // @ts-expect-error -- TSCONVERSION host can be undefined
        url: host,
        enableTls: true,
      };

    case 'grpc:':
      return {
        // @ts-expect-error -- TSCONVERSION host can be undefined
        url: host,
        enableTls: false,
      };

    default:
      return {
        url: href,
        enableTls: false,
      };
  }
};
const _createClient = (
  req: GrpcRequest,
  respond: ResponseCallbacks,
): ServiceClient | undefined => {
  const { url, enableTls } = parseGrpcUrl(req.url);
  if (!url) {
    respond.sendError(req._id, new Error('URL not specified'));
    return undefined;
  }
  const credentials = enableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
  console.log(`[gRPC] connecting to url=${url} ${enableTls ? 'with' : 'without'} TLS`);
  // @ts-expect-error -- TSCONVERSION second argument should be provided, send an empty string? Needs testing
  const Client = grpc.makeGenericClientConstructor({});
  return new Client(url, credentials);
};

export const start = (
  event: IpcMainEvent,
  { request }: GrpcIpcRequestParams,
) => {
  const respond = new ResponseCallbacks(event);
  const requestId = request._id;
  const metadata = request.metadata;
  protoLoader.getSelectedMethod(request)?.then(method => {
    if (!method) {
      respond.sendError(
        requestId,
        new Error(`The gRPC method ${request.protoMethodName} could not be found`),
      );
      return;
    }
    const methodType = getMethodType(method);
    // Create client
    const client = _createClient(request, respond);
    if (!client) {
      return;
    }
    const requestParams: RequestData = {
      requestId,
      client,
      method,
      respond,
      metadata,
    };
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
            _createUnaryCallback(requestId, respond),
          );
          break;
        case 'server':
          call = _makeServerStreamRequest(requestParams, messageBody);
          break;
        case 'client':
          call = client.makeClientStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(metadata),
            _createUnaryCallback(requestId, respond));
          break;
        case 'bidi':
          call = _makeBidiStreamRequest(requestParams);
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
      call.on('status', s => respond.sendStatus(requestId, s));
      respond.sendStart(requestId);
      // Save call
      callCache.set(requestId, call);
    } catch (error) {
      // TODO: How do we want to handle this case, where the message cannot be parsed?
      //  Currently an error will be shown, but the stream will not be cancelled.
      respond.sendError(requestId, error);
      return;
    }

  });
};

export const sendMessage = (
  event: IpcMainEvent,
  { body, requestId }: GrpcIpcMessageParams,
) => {
  const respond = new ResponseCallbacks(event);
  try {
    const messageBody = JSON.parse(body.text || '');
    // HACK BUT DO NOT REMOVE
    // this must happen in the next tick otherwise the stream does not flush correctly
    // Try removing it and using a bidi RPC and notice messages don't send consistently
    process.nextTick(() => {
    // @ts-expect-error -- TSCONVERSION only write if the call is ClientWritableStream | ClientDuplexStream
      callCache.get(requestId)?.write(messageBody, _streamWriteCallback);
    });
  } catch (error) {
    respond.sendError(requestId, error);
  }
};

// @ts-expect-error -- TSCONVERSION only end if the call is ClientWritableStream | ClientDuplexStream
export const commit = (requestId: string): void => callCache.get(requestId)?.end();
export const cancel = (requestId: string): void => callCache.get(requestId)?.cancel();
export const cancelMultiple = (requestIds: string[]): void => requestIds.forEach(cancel);

const _setupServerStreamListeners = (call: Call, requestId: string, respond: ResponseCallbacks) => {
  call.on('data', data => respond.sendData(requestId, data));
  call.on('error', (error: ServiceError) => {
    if (error && error.code !== grpc.status.CANCELLED) {
      respond.sendError(requestId, error);
      // Taken through inspiration from other implementation, needs validation
      if (error.code === grpc.status.UNKNOWN || error.code === grpc.status.UNAVAILABLE) {
        respond.sendEnd(requestId);
        callCache.delete(requestId);
      }
    }
  });
  call.on('end', () => {
    respond.sendEnd(requestId);
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

// This function returns a function
const _createUnaryCallback = (requestId: string, respond: ResponseCallbacks) => (
  err: ServiceError | null,
  value?: Record<string, any>,
) => {
  if (err) {
    // Don't do anything if cancelled
    // TODO: test with other errors
    if (err.code !== grpc.status.CANCELLED) {
      respond.sendError(requestId, err);
    }
  } else {
    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    respond.sendData(requestId, value!);
  }
  respond.sendEnd(requestId);
  // @ts-expect-error -- TSCONVERSION channel not found in call
  const channel = callCache.get(requestId)?.call?.call.channel;
  if (channel) {
    channel.close();
  } else {
    console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
  }
  callCache.delete(requestId);
};

type WriteCallback = (error: Error | null | undefined) => void;

const _streamWriteCallback: WriteCallback = err => {
  if (err) {
    console.error('[gRPC] Error when writing to stream', err);
  }
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
