import { Call, ClientDuplexStream, ClientReadableStream, ServiceError, StatusObject } from '@grpc/grpc-js';
import { credentials, makeGenericClientConstructor, Metadata, status } from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { AnyDefinition, EnumTypeDefinition, MessageTypeDefinition, PackageDefinition } from '@grpc/proto-loader';
import electron, { ipcMain } from 'electron';
import { IpcMainEvent } from 'electron';
import * as grpcReflection from 'grpc-reflection-js';

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
  loadMethods: typeof loadMethods;
  loadMethodsFromReflection: typeof loadMethodsFromReflection;
  closeAll: typeof closeAll;
}
export function registergRPCHandlers() {
  ipcMain.on('grpc.start', start);
  ipcMain.on('grpc.sendMessage', sendMessage);
  ipcMain.on('grpc.commit', (_, requestId) => commit(requestId));
  ipcMain.on('grpc.cancel', (_, requestId) => cancel(requestId));
  ipcMain.on('grpc.closeAll', closeAll);
  ipcMain.handle('grpc.loadMethods', (_, requestId) => loadMethods(requestId));
  ipcMain.handle('grpc.loadMethodsFromReflection', (_, url) => loadMethodsFromReflection(url));
}
const loadMethodsFromFilePath = async (filePath: string, includeDirs: string[]): Promise<MethodDefs[]> => {
  try {
    const definition = await protoLoader.load(filePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs,
    });
    return getMethodsFromPackageDefinition(definition);
  } catch (error) {
    throw error;
  }
};
const loadMethods = async (protoFileId: string): Promise<GrpcMethodInfo[]> => {
  const protoFile = await models.protoFile.getById(protoFileId);
  invariant(protoFile, `Proto file ${protoFileId} not found`);
  const { filePath, dirs } = await writeProtoFile(protoFile);
  const methods = await loadMethodsFromFilePath(filePath, dirs);
  return methods.map(method => ({
    type: getMethodType(method),
    fullPath: method.path,
  }));
};
interface MethodDefs {
  path: string;
  requestStream: boolean;
  responseStream: boolean;
  requestSerialize: (value: any) => Buffer;
  responseDeserialize: (value: Buffer) => any;
}
const getMethodsFromReflection = async (host: string): Promise<MethodDefs[]> => {
  try {
    const { url, enableTls } = parseGrpcUrl(host);
    const client = new grpcReflection.Client(url, enableTls ? credentials.createSsl() : credentials.createInsecure());
    const services = await client.listServices() as string[];
    const methodsPromises = services.map(async service => {
      const fileContainingSymbol = await client.fileContainingSymbol(service);
      const descriptorMessage = fileContainingSymbol.toDescriptor('proto3');
      const tryToGetMethods = () => {
        try {
          console.log('[grpc] loading service from reflection:', service);
          const packageDefinition = protoLoader.loadFileDescriptorSetFromObject(descriptorMessage, {});
          return getMethodsFromPackageDefinition(packageDefinition);
        } catch (e) {
          console.error(e);
          return [];
        }
      };
      const methods = tryToGetMethods();
      return methods;
    });
    return (await Promise.all(methodsPromises)).flat();
  } catch (error) {
    throw error;
  }
};
const loadMethodsFromReflection = async (url: string): Promise<GrpcMethodInfo[]> => {
  const methods = await getMethodsFromReflection(url);
  return methods.map(method => ({
    type: getMethodType(method),
    fullPath: method.path,
  }));
};
export interface GrpcMethodInfo {
  type: GrpcMethodType;
  fullPath: string;
}
export const getMethodType = ({ requestStream, responseStream }: any): GrpcMethodType => {
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

export const getSelectedMethod = async (request: GrpcRequest): Promise<MethodDefs | undefined> => {
  if (request.protoFileId) {
    const protoFile = await models.protoFile.getById(request.protoFileId);
    invariant(protoFile?.protoText, `No proto file found for gRPC request ${request._id}`);
    const { filePath, dirs } = await writeProtoFile(protoFile);
    const methods = await loadMethodsFromFilePath(filePath, dirs);
    invariant(methods, 'No methods found');
    return methods.find(c => c.path === request.protoMethodName);
  }
  const methods = await getMethodsFromReflection(request.url);
  invariant(methods, 'No reflection methods found');
  return methods.find(c => c.path === request.protoMethodName);
};
export const getMethodsFromPackageDefinition = (packageDefinition: PackageDefinition): MethodDefs[] => {
  return Object.values(packageDefinition)
    .filter((obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => !obj.format)
    .flatMap(Object.values);
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
          unaryCall.on('status', (status: StatusObject) => event.reply('grpc.status', request._id, status));
          grpcCalls.set(request._id, unaryCall);
          break;
        case 'client':
          const clientCall = client.makeClientStreamRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            filterDisabledMetaData(request.metadata),
            onUnaryResponse(event, request._id));
          clientCall.on('status', (status: StatusObject) => event.reply('grpc.status', request._id, status));
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

      event.reply('grpc.start', request._id);

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
