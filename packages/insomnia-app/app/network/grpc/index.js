// @flow

import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

import * as models from '../../models';
import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import type { GrpcMethodDefinition } from './method';
import { getMethodType, GrpcMethodTypeEnum } from './method';

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

const isTypeOrEnumDefinition = (obj: Object) =>
  obj.hasOwnProperty('format') && obj.format.endsWith('DescriptorProto');

const isServiceDefinition = (obj: Object) => !isTypeOrEnumDefinition(obj);

export const loadMethods = async (protoFile: ProtoFile): Promise<Array<GrpcMethodDefinition>> => {
  const tempProtoFile = await writeTempFile(protoFile.protoText);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);

  return Object.values(definition)
    .filter(isServiceDefinition)
    .flatMap(Object.values);
};

const createClient = (req: GrpcRequest) => {
  const Client = grpc.makeGenericClientConstructor({});
  return new Client(req.url, grpc.credentials.createInsecure());
};

export const sendUnary = async (requestId: string): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const protoFile = await models.protoFile.getById(req.protoFileId);

  // TODO: maybe do this when activating a request or when changing the selected protoFile
  const methods = await loadMethods(protoFile);

  const selectedMethod = methods.find(c => c.path === req.protoMethodName);

  if (!selectedMethod) {
    console.log('method not found');
    return;
  }

  // safety net
  if (getMethodType(selectedMethod) !== GrpcMethodTypeEnum.unary) {
    console.log('selected method is not unary');
    return;
  }

  // TODO: decide where the following try-catch is best
  let messageBody = {};
  try {
    messageBody = JSON.parse(req.body.text);
  } catch (e) {
    console.log(e);
    return;
  }

  // Create client
  const client = createClient(req);

  const callback = (err, value) => {
    if (err) {
      console.log(err);
    } else {
      console.log(value);
    }
    client.close();
  };

  // Make call
  client.makeUnaryRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    messageBody,
    callback,
  );
};

const calls = {};

const getCallForId = (requestId: string) => calls[requestId];

const saveCallForId = (requestId: string, call: Object) => {
  calls[requestId] = call;
};

const clearCallForId = (requestId: string) => {
  calls[requestId] = null;
};

export const startClientStreaming = async (requestId: string): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const protoFile = await models.protoFile.getById(req.protoFileId);

  // TODO: maybe do this when activating a request or when changing the selected protoFile
  const methods = await loadMethods(protoFile);

  const selectedMethod = methods.find(c => c.path === req.protoMethodName);

  if (!selectedMethod) {
    console.log('method not found');
    return;
  }

  // safety net
  if (getMethodType(selectedMethod) !== GrpcMethodTypeEnum.client) {
    console.log('selected method is not client streaming');
    return;
  }

  // Create client
  const client = createClient(req);

  const callback = (err, value) => {
    if (err) {
      console.log(err);
    } else {
      console.log(value);
    }
    client.close();
    clearCallForId(requestId);
  };

  // Make call
  const call = client.makeClientStreamRequest(
    selectedMethod.path,
    selectedMethod.requestSerialize,
    selectedMethod.responseDeserialize,
    callback,
  );

  saveCallForId(requestId, call);
};

export const sendMessage = async (requestId: string) => {
  const req = await models.grpcRequest.getById(requestId);

  // TODO: decide where the following try-catch is best
  let messageBody = {};
  try {
    messageBody = JSON.parse(req.body.text);
  } catch (e) {
    console.log(e);
    return;
  }

  const call = getCallForId(requestId);

  if (!call) {
    console.log('call not found');
    return;
  }

  console.log('new message');
  call.write(messageBody, () => console.log('written'));
};

export const commit = (requestId: string) => {
  const call = getCallForId(requestId);

  if (!call) {
    console.log('call not found');
    return;
  }

  console.log('commit');
  call.end();
};

export const cancel = (requestId: string) => {
  const call = getCallForId(requestId);

  if (!call) {
    console.log('call not found');
    return;
  }

  console.log('cancel');
  call.cancel();
};
