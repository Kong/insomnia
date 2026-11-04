import { credentials, Metadata, Server, ServerCredentials, type ServiceDefinition } from '@grpc/grpc-js';
import { ServerReflectionService } from 'grpc-reflection-js/build/src/reflection_grpc_pb';
import * as reflectionPb from 'grpc-reflection-js/build/src/reflection_pb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createReflectionClient } from '../grpc-reflection-client';

// The bundled types omit these classes
const { ListServiceResponse, ServerReflectionResponse, ServiceResponse } = reflectionPb as any;

const service = new ServiceResponse();
service.setName('test.Service');
const list = new ListServiceResponse();
list.addService(service);
const reply = new ServerReflectionResponse();
reply.setListServicesResponse(list);

describe('createReflectionClient', () => {
  const server = new Server();
  let url = '';

  beforeAll(async () => {
    const method = ServerReflectionService.serverReflectionInfo;
    const definition = { serverReflectionInfo: { ...method, path: `/prefix${method.path}` } };
    server.addService(definition as unknown as ServiceDefinition, {
      serverReflectionInfo: (call: NodeJS.ReadWriteStream) => {
        call.on('data', () => call.write(reply as never));
        call.on('end', () => call.end());
      },
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (err, bound) =>
        err ? reject(err) : resolve(bound),
      );
    });
    url = `127.0.0.1:${port}`;
  });

  afterAll(() => server.forceShutdown());

  it('reaches a reflection service behind a path prefix', async () => {
    const client = createReflectionClient(url, '/prefix', credentials.createInsecure(), {}, new Metadata());

    await expect(client.listServices()).resolves.toEqual(['test.Service']);
  });

  it('fails without the prefix', async () => {
    const client = createReflectionClient(url, '', credentials.createInsecure(), {}, new Metadata());

    await expect(client.listServices()).rejects.toThrow();
  });
});
