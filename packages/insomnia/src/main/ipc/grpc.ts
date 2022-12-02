import { Call, ClientDuplexStream, ClientReadableStream, MethodDefinition, ServiceError, StatusObject } from '@grpc/grpc-js';
import { credentials, Metadata, status } from '@grpc/grpc-js';
import { AnyDefinition, EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';
import * as protoLoader from '@grpc/proto-loader';
import electron, { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';
import { Client } from 'grpc-reflection-js';

import { getMethodInfo, getMethodType, GrpcMethodInfo } from '../../common/grpc-paths';
import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import * as models from '../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../models/grpc-request';
import { parseGrpcUrl } from '../../network/grpc/parse-grpc-url';
import { writeProtoFile } from '../../network/grpc/write-proto-file';
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
  cancelMultiple: typeof cancelMultiple;
  loadMethods: typeof loadMethods;
  closeAll: typeof closeAll;
}
export function registergRPCHandlers() {
  ipcMain.on('grpc.start', start);
  ipcMain.on('grpc.sendMessage', sendMessage);
  ipcMain.on('grpc.commit', (_, requestId) => commit(requestId));
  ipcMain.on('grpc.cancel', (_, requestId) => cancel(requestId));
  ipcMain.on('grpc.cancelMultiple', (_, requestIds) => cancelMultiple(requestIds));
  ipcMain.on('grpc.closeAll', closeAll);
  ipcMain.handle('grpc.loadMethods', (_, requestId) => loadMethods(requestId));
}
const loadMethods = async (protoFileId: string): Promise<GrpcMethodInfo[]> => {
  const protoFile = await models.protoFile.getById(protoFileId);
  invariant(protoFile, `Proto file ${protoFileId} not found`);
  const { filePath, dirs } = await writeProtoFile(protoFile);
  const definition = await protoLoader.load(filePath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: dirs,
  });
  console.log(definition);
  const methods = Object.values(definition).filter((obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => !obj.format).flatMap(Object.values);
  return methods.map(getMethodInfo);
};

// TODO: instead of reloading the methods from the protoFile,
//  just get it from what has already been loaded in the react component,
//  or from the cache
//  We can't send the method over IPC because of the following deprecation in Electron v9
//  https://www.electronjs.org/docs/breaking-changes#behavior-changed-sending-non-js-objects-over-ipc-now-throws-an-exception
export const getSelectedMethod = async (request: GrpcRequest): Promise<MethodDefinition<any, any> | undefined> => {
  invariant(request.protoFileId, 'protoFileId is required');
  const protoFile = await models.protoFile.getById(request.protoFileId);
  invariant(protoFile?.protoText, `No proto file found for gRPC request ${request._id}`);
  const { filePath, dirs } = await writeProtoFile(protoFile);
  const definition = await protoLoader.load(filePath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: dirs,
  });
  return Object.values(definition).filter((obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => !obj.format).flatMap(Object.values).find(c => c.path === request.protoMethodName);
};
const reflection = async (url: string, client: Client) => {
  const services = (await client.listServices()) as string[];
  const serviceRoots = await Promise.all(
    services
      .filter(s => s && s !== 'grpc.reflection.v1alpha.ServerReflection')
      .map((service: string) => client.fileContainingSymbol(service))
  );

  const protos = serviceRoots.map(root => {
    return {
      fileName: root.files[root.files.length - 1],
      filePath: url,
      protoText: 'proto text not supported in gRPC reflection',
      ast: protoLoader.loadFileDescriptorSetFromObject(root.toJSON()),
      root: root,
    };
  });
  // protoLoader.
  // console.log(protoLoader.loadSync(root));
  return protos;
};
export const start = (
  event: IpcMainEvent,
  { request }: GrpcIpcRequestParams,
) => {
  getSelectedMethod(request)?.then(method => {
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
    const client = new Client(url, enableTls ? credentials.createSsl() : credentials.createInsecure());
    if (!client.grpcClient) {
      return;
    }
    reflection(url, client).then(services => {
      console.log(services);
      try {
        const messageBody = JSON.parse(request.body.text || '');
        switch (methodType) {
          case 'unary':
            const unaryCall = client.grpcClient.makeUnaryRequest(
              method.path,
              method.requestSerialize,
              method.responseDeserialize,
              messageBody,
              filterDisabledMetaData(request.metadata),
              onUnaryResponse(event, request._id),
            );
            unaryCall.on('status', (status: StatusObject) => event.reply('grpc.status', request._id, status));
            grpcCalls.set(request._id, unaryCall);
            break;
          case 'client':
            const clientCall = client.grpcClient.makeClientStreamRequest(
              method.path,
              method.requestSerialize,
              method.responseDeserialize,
              filterDisabledMetaData(request.metadata),
              onUnaryResponse(event, request._id));
            clientCall.on('status', (status: StatusObject) => event.reply('grpc.status', request._id, status));
            grpcCalls.set(request._id, clientCall);
            break;
          case 'server':
            const serverCall = client.grpcClient.makeServerStreamRequest(
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
            const bidiCall = client.grpcClient.makeBidiStreamRequest(
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

        event.reply('grpc.start', request._id);

      } catch (error) {
      // TODO: How do we want to handle this case, where the message cannot be parsed?
      //  Currently an error will be shown, but the stream will not be cancelled.
        event.reply('grpc.error', request._id, error);
      }
    });

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
export const cancelMultiple = (requestIds: string[]): void => requestIds.forEach(cancel);

const onStreamingResponse = (event: IpcMainEvent, call: ClientReadableStream<any> | ClientDuplexStream<any, any>, requestId: string) => {
  call.on('status', (status: StatusObject) => event.reply('grpc.status', requestId, status));
  call.on('data', data => event.reply('grpc.data', requestId, data));
  call.on('error', (error: ServiceError) => {
    if (error && error.code !== status.CANCELLED) {
      event.reply('grpc.error', requestId, error);
      // Taken through inspiration from other implementation, needs validation
      if (error.code === status.UNKNOWN || error.code === status.UNAVAILABLE) {
        event.reply('grpc.end', requestId);
        grpcCalls.delete(requestId);
      }
    }
  });
  call.on('end', () => {
    event.reply('grpc.end', requestId);
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

const onUnaryResponse = (event: IpcMainEvent, requestId: string) => (err: ServiceError | null, value?: Record<string, any>) => {
  if (!err) {
    event.reply('grpc.data', requestId, value);
  }
  if (err && err.code !== status.CANCELLED) {
    event.reply('grpc.error', requestId, err);
  }
  event.reply('grpc.end', requestId);
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
const closeAll = (): void => grpcCalls.forEach(x => x.cancel());

electron.app.on('window-all-closed', closeAll);
