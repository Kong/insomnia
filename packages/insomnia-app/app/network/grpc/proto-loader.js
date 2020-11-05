// @flow
import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import type { GrpcMethodDefinition } from './method';
import * as protoLoader from '@grpc/proto-loader';
import * as models from '../../models';

const writeTempFile = async (src: string): Promise<string> => {
  const root = path.join(os.tmpdir(), 'insomnia-grpc');
  mkdirp.sync(root);
  const p = path.join(root, `${Math.random()}.proto`);
  await fs.promises.writeFile(p, src);
  return p;
};

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
//  add an in-memory caching strategy, indexed by the protoFile._id
export const loadMethods = async (protoFile: ProtoFile): Promise<Array<GrpcMethodDefinition>> => {
  const tempProtoFile = await writeTempFile(protoFile.protoText);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);

  return Object.values(definition)
    .filter(isServiceDefinition)
    .flatMap(Object.values);
};

// TODO: instead of reloading the methods from the protoFile,
//  just get it from what has already been loaded in the react component
export const getSelectedMethod = async (request: GrpcRequest): GrpcMethodDefinition | undefined => {
  const protoFile = await models.protoFile.getById(request.protoFileId);

  const methods = await loadMethods(protoFile);

  return methods.find(c => c.path === request.protoMethodName);
};
