// @flow

import type { GrpcMethodDefinition } from './method';
import * as protoLoader from '@grpc/proto-loader';
import * as models from '../../models';
import writeProtoFile from './write-proto-file';

const GRPC_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const isTypeOrEnumDefinition = (obj: Object) => 'format' in obj; // same check exists internally in the grpc library
const isServiceDefinition = (obj: Object) => !isTypeOrEnumDefinition(obj);

// TODO: The file path for protoLoader.load can also be a URL, so we can avoid
//  writing to a file in those cases, but it becomes more important to cache
//  We also need to think about how to store a reference to a proto file and it's
//  implications on import/export/sync - INS-271
export const loadMethods = async (
  protoFile: ProtoFile | undefined,
): Promise<Array<GrpcMethodDefinition>> => {
  if (!protoFile?.protoText) {
    return [];
  }

  return await loadMethodsFromText(protoFile.protoText);
};

export const loadMethodsFromText = async (text: string): Promise<Array<GrpcMethodDefinition>> => {
  const tempProtoFile = await writeProtoFile(text);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);

  return Object.values(definition)
    .filter(isServiceDefinition)
    .flatMap(Object.values);
};

// TODO: instead of reloading the methods from the protoFile,
//  just get it from what has already been loaded in the react component,
//  or from the cache
//  We can't send the method over IPC because of the following deprecation in Electron v9
//  https://www.electronjs.org/docs/breaking-changes#behavior-changed-sending-non-js-objects-over-ipc-now-throws-an-exception
export const getSelectedMethod = async (request: GrpcRequest): GrpcMethodDefinition | undefined => {
  const protoFile = await models.protoFile.getById(request.protoFileId);

  const methods = await loadMethods(protoFile);

  return methods.find(c => c.path === request.protoMethodName);
};
