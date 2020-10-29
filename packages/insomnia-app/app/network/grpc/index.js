// @flow

import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

import * as models from '../../models';
import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';

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

export const sendUnary = async (requestId: string): Promise<void> => {
  const req = await models.grpcRequest.getById(requestId);
  const protoFile = await models.protoFile.getById(req.protoFileId);

  // Load package
  const tempProtoFile = await writeTempFile(protoFile.protoText);
  const definition = await protoLoader.load(tempProtoFile, GRPC_LOADER_OPTIONS);
  const protoPackage = grpc.loadPackageDefinition(definition); // maybe store this in context?

  // List all available methods
  const methods = Object.values(protoPackage)
    .flatMap(c => Object.values(c))
    .filter(c => typeof c === 'function')
    .flatMap(c => Object.values(c.service))
    .map(c => c.path);

  // Pick the first one
  const selectedMethod = methods[0];

  // Split full path into package, service and method name
  const [packageName, serviceName, methodName] = selectedMethod.split(/\.|\//).filter(c => c);

  // Create stub
  const stub = new protoPackage[packageName][serviceName](
    'grpcb.in:9000',
    grpc.credentials.createInsecure(),
  );

  // Make call
  stub[methodName]({ greeting: 'Insomnia' }, function(err, feature) {
    if (err) {
      console.log(err);
    } else {
      console.log(feature);
    }
  });
};
