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

// TODO: instead of writing to a temp file and loading the protoFile every time methods are required,
//  add an in-memory caching strategy, indexed by the protoFile._id.
//  The file path for protoLoader.load can also be a URL, so we can avoid
//  writing to a file in those cases, but it becomes more important to cache
//  We also need to think about how to store a reference to a proto file and it's
//  implications on import/export/sync.
export const loadMethods = async (protoFile: ProtoFile): Promise<Array<GrpcMethodDefinition>> => {
  const tempProtoFile = await writeProtoFile(protoFile.protoText);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);

  return Object.values(definition)
    .filter(isServiceDefinition)
    .flatMap(Object.values);
};

// TODO: instead of reloading the methods from the protoFile,
//  just get it from what has already been loaded in the react component,
//  or from the cache
export const getSelectedMethod = async (request: GrpcRequest): GrpcMethodDefinition | undefined => {
  const protoFile = await models.protoFile.getById(request.protoFileId);

  const methods = await loadMethods(protoFile);

  return methods.find(c => c.path === request.protoMethodName);
};
