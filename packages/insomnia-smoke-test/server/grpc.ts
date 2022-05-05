// inspiration: https://github.com/grpc/grpc/blob/e963544eef6a76f9f86d43418ee2ac57aebba6f6/examples/node/dynamic_codegen/greeter_server.js
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve('../../packages/insomnia/src/network/grpc/__fixtures__/library/hello.proto');
const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

const helloProto = grpc.loadPackageDefinition(packageDefinition).hello;

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
  callback(null, { reply: call.request.greeting });
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the given port
 */
export const startGRPCServer = (port: number) => {
  return new Promise<void>(resolve => {
    const server = new grpc.Server();
    // @ts-expect-error generated from proto file
    server.addService(helloProto.HelloService.service, { sayHello: sayHello });
    server.bindAsync(`localhost:${port}`, grpc.ServerCredentials.createInsecure(), () => {
      console.log(`Listening at grpc://localhost:${port}`);
      server.start();
      resolve();
    });
  });
};
