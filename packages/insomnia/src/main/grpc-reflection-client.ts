import { type ChannelCredentials, makeGenericClientConstructor, type Metadata, type ServiceDefinition } from '@grpc/grpc-js';
import * as grpcReflection from 'grpc-reflection-js';
import { ServerReflectionService } from 'grpc-reflection-js/build/src/reflection_grpc_pb';

// grpc-reflection-js always calls the root path, so route it through a client with prefixed method paths
export const createReflectionClient = (
  url: string,
  path: string,
  credentials: ChannelCredentials,
  options: object,
  metadata: Metadata,
) => {
  const client = new grpcReflection.Client(url, credentials, options, metadata);
  if (path) {
    const prefixed = Object.fromEntries(
      Object.entries(ServerReflectionService).map(([name, method]) => [
        name,
        { ...method, path: `${path}${method.path}` },
      ]),
    ) as unknown as ServiceDefinition;
    const PrefixedClient = makeGenericClientConstructor(prefixed, 'ServerReflection');
    client.grpcClient = new PrefixedClient(url, credentials, options) as unknown as typeof client.grpcClient;
  }
  return client;
};
