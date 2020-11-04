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
  // TODO: Maybe we should be smarter about where to write to, instead of a random file each time
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

export const loadMethods = async (protoFile: ProtoFile): Promise<Array<GrpcMethodDefinition>> => {
  const tempProtoFile = await writeTempFile(protoFile.protoText);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);

  return Object.values(definition)
    .filter(isServiceDefinition)
    .flatMap(Object.values);
};

export const getSelectedMethod = async (request: GrpcRequest): GrpcMethodDefinition | undefined => {
  const protoFile = await models.protoFile.getById(request.protoFileId);

  // TODO: maybe do this when activating a request or when changing the selected protoFile
  const methods = await loadMethods(protoFile);

  return methods.find(c => c.path === request.protoMethodName);
};
