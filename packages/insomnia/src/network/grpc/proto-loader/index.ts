import * as protoLoader from '@grpc/proto-loader';
import { AnyDefinition, EnumTypeDefinition, MessageTypeDefinition, ServiceDefinition } from '@grpc/proto-loader';

import * as models from '../../../models';
import { GrpcRequest } from '../../../models/grpc-request';
import { ProtoFile } from '../../../models/proto-file';
import type { GrpcMethodDefinition } from '../method';
import writeProtoFile from './write-proto-file';

const GRPC_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const isTypeOrEnumDefinition = (obj: AnyDefinition): obj is EnumTypeDefinition | MessageTypeDefinition => 'format' in obj; // same check exists internally in the grpc library

const isServiceDefinition = (obj: AnyDefinition): obj is ServiceDefinition => !isTypeOrEnumDefinition(obj);

// TODO: The file path for protoLoader.load can also be a URL, so we can avoid
//  writing to a file in those cases, but it becomes more important to cache
export const loadMethods = async (
  protoFile?: ProtoFile | null,
): Promise<GrpcMethodDefinition[]> => {
  if (!protoFile?.protoText) {
    return [];
  }

  const { filePath, dirs } = await writeProtoFile(protoFile);
  return await loadMethodsFromPath(filePath, dirs);
};

export const loadMethodsFromPath = async (
  filePath: string,
  includeDirs?: string[],
): Promise<GrpcMethodDefinition[]> => {
  const definition = await protoLoader.load(filePath, { ...GRPC_LOADER_OPTIONS, includeDirs });
  return Object.values(definition).filter(isServiceDefinition).flatMap(Object.values);
};

// TODO: instead of reloading the methods from the protoFile,
//  just get it from what has already been loaded in the react component,
//  or from the cache
//  We can't send the method over IPC because of the following deprecation in Electron v9
//  https://www.electronjs.org/docs/breaking-changes#behavior-changed-sending-non-js-objects-over-ipc-now-throws-an-exception
// @ts-expect-error -- TSCONVERSION
export const getSelectedMethod = async (request: GrpcRequest): GrpcMethodDefinition | undefined => {
  // @ts-expect-error -- TSCONVERSION
  const protoFile = await models.protoFile.getById(request.protoFileId);
  const methods = await loadMethods(protoFile);
  return methods.find(c => c.path === request.protoMethodName);
};
