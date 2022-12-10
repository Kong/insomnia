import { Call, ClientDuplexStream, ClientReadableStream, MethodDefinition, ServiceError, StatusObject } from '@grpc/grpc-js';
import { credentials, makeGenericClientConstructor, Metadata, status } from '@grpc/grpc-js';
import { AnyDefinition, EnumTypeDefinition, load, MessageTypeDefinition, PackageDefinition } from '@grpc/proto-loader';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IpcMainEvent } from 'electron';

import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import * as models from '../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../models/grpc-request';
import { parseGrpcUrl } from '../../network/grpc/parse-grpc-url';
import { SegmentEvent, trackSegmentEvent } from '../../ui/analytics';
import { invariant } from '../../utils/invariant';

const grpcCalls = new Map<string, Call>();
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
  loadMethods: typeof loadMethods;
  closeAll: typeof closeAllGrpcs;
}
export function registergRPCHandlers() {
  ipcMain.handle('grpc.start', start);
  ipcMain.on('grpc.sendMessage', sendMessage);
  ipcMain.on('grpc.commit', (_, requestId) => commit(requestId));
  ipcMain.on('grpc.cancel', (_, requestId) => cancel(requestId));
  ipcMain.on('grpc.closeAll', closeAllGrpcs);
  ipcMain.handle('grpc.loadMethods', (_, requestId) => loadMethods(requestId));
}
const getDefinition = async (request: GrpcRequest): Promise<PackageDefinition> => {
  const { protoFilePath, includeDirs } = request;
  invariant(protoFilePath, `Proto file at ${protoFilePath} not found`);
  try {
    return await load(protoFilePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs,
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
};
const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;

export interface GrpcPathSegments {
  packageName?: string;
  serviceName?: string;
  methodName?: string;
}

// Split a full gRPC path into it's segments
const getGrpcPathSegments = (path: string) => ({
  packageName: PROTO_PATH_REGEX.exec(path)?.groups?.package,
  serviceName: PROTO_PATH_REGEX.exec(path)?.groups?.service,
  methodName: PROTO_PATH_REGEX.exec(path)?.groups?.method,
});
export interface GrpcMethodInfo {
  segments: GrpcPathSegments;
  type: GrpcMethodType;
  fullPath: string;
}
export const getMethodType = ({ requestStream, responseStream }: MethodDefinition<any, any>): GrpcMethodType => {
  if (requestStream && responseStream) {
    return 'bidi';
  }
  if (requestStream) {
    return 'client';
  }
  if (responseStream) {
    return 'server';
  }
  return 'unary';
};
export const getMethodInfo = (method: MethodDefinition<any, any>): GrpcMethodInfo => ({
  segments: getGrpcPathSegments(method.path),
  type: getMethodType(method),
  fullPath: method.path,
});
const loadMethods = async (requestId: string): Promise<GrpcMethodInfo[]> => {
  const request = await models.grpcRequest.getById(requestId);
  invariant(request, `Request ${requestId} not found`);
  const definition = await getDefinition(request);
  const methods = Object.values(definition).filter((obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => !obj.format).flatMap(Object.values);
  return methods.map(getMethodInfo);
};

export const start = async (
  event: IpcMainInvokeEvent,
  { request }: GrpcIpcRequestParams,
) => {
  const definition = getDefinition(request);
  invariant(definition, 'Proto file is invalid');
  const method = Object.values(definition)
    .filter((obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => !obj.format)
    .flatMap(Object.values).find(c => c.path === request.protoMethodName);

  if (!method) {
    event.sender.send('grpc.error', request._id, new Error(`The gRPC method ${request.protoMethodName} could not be found`));
    return;
  }
  const methodType = getMethodType(method);
  // Create client
  const { url, enableTls } = parseGrpcUrl(request.url);
  if (!url) {
    event.sender.send('grpc.error', request._id, new Error('URL not specified'));
    return undefined;
  }
  console.log(`[gRPC] connecting to url=${url} ${enableTls ? 'with' : 'without'} TLS`);
  // @ts-expect-error -- TSCONVERSION second argument should be provided, send an empty string? Needs testing
  const Client = makeGenericClientConstructor({});
  const client = new Client(url, enableTls ? credentials.createSsl() : credentials.createInsecure());
  if (!client) {
    return;
  }

  try {
    const messageBody = JSON.parse(request.body.text || '');
    switch (methodType) {
      case 'unary':
        const unaryCall = client.makeUnaryRequest(
          method.path,
          method.requestSerialize,
          method.responseDeserialize,
          messageBody,
          filterDisabledMetaData(request.metadata),
          onUnaryResponse(event, request._id),
        );
        unaryCall.on('status', (status: StatusObject) => event.sender.send('grpc.status', request._id, status));
        grpcCalls.set(request._id, unaryCall);
        break;
      case 'client':
        const clientCall = client.makeClientStreamRequest(
          method.path,
          method.requestSerialize,
          method.responseDeserialize,
          filterDisabledMetaData(request.metadata),
          onUnaryResponse(event, request._id));
        clientCall.on('status', (status: StatusObject) => event.sender.send('grpc.status', request._id, status));
        grpcCalls.set(request._id, clientCall);
        break;
      case 'server':
        const serverCall = client.makeServerStreamRequest(
          method.path,
          method.requestSerialize,
          method.responseDeserialize,
          messageBody,
          filterDisabledMetaData(request.metadata),
        );
        onStreamingResponse(event, serverCall, request._id);
        grpcCalls.set(request._id, serverCall);
        break;
      case 'bidi':
        const bidiCall = client.makeBidiStreamRequest(
          method.path,
          method.requestSerialize,
          method.responseDeserialize,
          filterDisabledMetaData(request.metadata));
        onStreamingResponse(event, bidiCall, request._id);
        grpcCalls.set(request._id, bidiCall);
        break;
      default:
        return;
    }
    // Update request stats
    models.stats.incrementExecutedRequests();
    trackSegmentEvent(SegmentEvent.requestExecute);

    event.sender.send('grpc.start', request._id);

  } catch (error) {
    // TODO: How do we want to handle this case, where the message cannot be parsed?
    //  Currently an error will be shown, but the stream will not be cancelled.
    event.sender.send('grpc.error', request._id, error);
  }
  return;
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
      grpcCalls.get(requestId)?.write(messageBody, err => {
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
export const commit = (requestId: string): void => grpcCalls.get(requestId)?.end();
export const cancel = (requestId: string): void => grpcCalls.get(requestId)?.cancel();

const onStreamingResponse = (event: IpcMainInvokeEvent, call: ClientReadableStream<any> | ClientDuplexStream<any, any>, requestId: string) => {
  call.on('status', (status: StatusObject) => event.sender.send('grpc.status', requestId, status));
  call.on('data', data => event.sender.send('grpc.data', requestId, data));
  call.on('error', (error: ServiceError) => {
    if (error && error.code !== status.CANCELLED) {
      event.sender.send('grpc.error', requestId, error);
      // Taken through inspiration from other implementation, needs validation
      if (error.code === status.UNKNOWN || error.code === status.UNAVAILABLE) {
        event.sender.send('grpc.end', requestId);
        grpcCalls.delete(requestId);
      }
    }
  });
  call.on('end', () => {
    event.sender.send('grpc.end', requestId);
    // @ts-expect-error -- TSCONVERSION channel not found in call
    const channel = grpcCalls.get(requestId)?.call?.call.channel;
    if (channel) {
      channel.close();
    } else {
      console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
    }
    grpcCalls.delete(requestId);
  });
};

const onUnaryResponse = (event: IpcMainInvokeEvent, requestId: string) => (err: ServiceError | null, value?: Record<string, any>) => {
  if (!err) {
    event.sender.send('grpc.data', requestId, value);
  }
  if (err && err.code !== status.CANCELLED) {
    event.sender.send('grpc.error', requestId, err);
  }
  event.sender.send('grpc.end', requestId);
  // @ts-expect-error -- TSCONVERSION channel not found in call
  const channel = grpcCalls.get(requestId)?.call?.call.channel;
  if (channel) {
    channel.close();
  } else {
    console.log(`[gRPC] failed to close channel for req=${requestId} because it was not found`);
  }
  grpcCalls.delete(requestId);
};

const filterDisabledMetaData = (metadata: GrpcRequestHeader[],): Metadata => {
  const grpcMetadata = new Metadata();
  for (const entry of metadata) {
    if (!entry.disabled) {
      grpcMetadata.add(entry.name, entry.value);
    }
  }
  return grpcMetadata;
};

export type GrpcMethodType = 'unary' | 'server' | 'client' | 'bidi';
export const closeAllGrpcs = (): void => grpcCalls.forEach(x => x.cancel());
