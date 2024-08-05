import {
  AnyMessage,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import { UnaryResponse } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import * as grpcReflection from 'grpc-reflection-js';
import protobuf from 'protobufjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMethodsFromReflection } from '../grpc';

vi.mock('grpc-reflection-js');
vi.mock('@connectrpc/connect-node');

describe('loadMethodsFromReflection', () => {

  describe('one service reflection', () => {
    beforeEach(() => {
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as vi.Mock).mockImplementation(() => ({
        listServices: () => Promise.resolve(['FooService']),
        fileContainingSymbol: async () => {
          const parsed = protobuf.parse(`
            syntax = "proto3";

            message FooRequest {
                string foo = 1;
            }

            message FooResponse {
                string foo = 1;
            }

            service FooService {
                rpc Foo (FooRequest) returns (FooResponse);
            }`);
          return parsed.root;
        },
      }));
    });

    it('parses methods', async () => {
      const methods = await loadMethodsFromReflection({
        url: 'foo.com',
        metadata: [],
        reflectionApi: { enabled: false, apiKey: '', url: '', module: '' },
      });
      expect(methods).toStrictEqual([{
        type: 'unary',
        fullPath: '/FooService/Foo',
        example: {
          foo: 'Hello',
        },
      }]);
    });
  });

  describe('format service reflection', () => {
    beforeEach(() => {
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as vi.Mock).mockImplementation(() => ({
        listServices: () => Promise.resolve(['FooService']),
        fileContainingSymbol: async () => {
          const parsed = protobuf.parse(`
            syntax = "proto3";

            message FooRequest {
                string foo = 1;
            }

            message FooResponse {
                string foo = 1;
            }

            service FooService {
                rpc format (FooRequest) returns (FooResponse);
            }`);
          return parsed.root;
        },
      }));
    });

    it('parses methods', async () => {
      const methods = await loadMethodsFromReflection({
        url: 'foo.com',
        metadata: [],
        reflectionApi: { enabled: false, apiKey: '', url: '', module: '' },
      });
      expect(methods).toStrictEqual([{
        type: 'unary',
        fullPath: '/FooService/format',
        example: {
          foo: 'Hello',
        },
      }]);
    });
  });

  describe('multiple service reflection', () => {
    beforeEach(() => {
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as vi.Mock).mockImplementation(() => ({
        listServices: () => Promise.resolve(['FooService', 'BarService']),
        fileContainingSymbol: async () => {
          const parsed = protobuf.parse(`
            syntax = "proto3";

            message FooRequest {
                string foo = 1;
            }

            message FooResponse {
                string foo = 1;
            }

            message BarRequest {
                string bar = 1;
            }

            message BarResponse {
                string bar = 1;
            }

            service FooService {
                rpc Foo (FooRequest) returns (FooResponse);
            }

            service BarService {
                rpc Bar (BarRequest) returns (BarResponse);
            }`);
          return parsed.root;
        },
      }));
    });

    it('parses methods', async () => {
      const methods = await loadMethodsFromReflection({
        url: 'foo-bar.com',
        metadata: [],
        reflectionApi: { enabled: false, apiKey: '', url: '', module: '' },
      });
      expect(methods).toStrictEqual([{
        type: 'unary',
        fullPath: '/FooService/Foo',
        example: {
          foo: 'Hello',
        },
      }, {
        type: 'unary',
        fullPath: '/BarService/Bar',
        example: {
          bar: 'Hello',
        },
      }]);
    });
  });

  describe('buf reflection api', () => {
    it('loads module', async () => {
      (createConnectTransport as unknown as vi.Mock).mockImplementation(
        options => {
          expect(options.baseUrl).toStrictEqual('https://buf.build');
          return {
            async unary(
              service: ServiceType,
              method: MethodInfo,
              _: AbortSignal | undefined,
              __: number | undefined,
              header: HeadersInit | undefined,
              input: PartialMessage<AnyMessage>
            ): Promise<UnaryResponse> {
              expect(new Headers(header).get('Authorization')).toStrictEqual('Bearer TEST_KEY');
              expect(input).toStrictEqual({ module: 'buf.build/connectrpc/eliza' });
              return {
                service: service,
                method: method,
                header: new Headers(),
                trailer: new Headers(),
                stream: false,
                // Output of running `buf curl https://buf.build/buf.reflect.v1beta1.FileDescriptorSetService/GetFileDescriptorSet --data '{"module": "buf.build/connectrpc/eliza"}' --schema buf.build/bufbuild/reflect -H 'Authorization: Bearer buf-token'`
                message: method.O.fromJsonString(
                  '{"fileDescriptorSet":{"file":[{"name":"connectrpc/eliza/v1/eliza.proto","package":"connectrpc.eliza.v1","messageType":[{"name":"SayRequest","field":[{"name":"sentence","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"sentence"}]},{"name":"SayResponse","field":[{"name":"sentence","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"sentence"}]},{"name":"ConverseRequest","field":[{"name":"sentence","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"sentence"}]},{"name":"ConverseResponse","field":[{"name":"sentence","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"sentence"}]},{"name":"IntroduceRequest","field":[{"name":"name","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"name"}]},{"name":"IntroduceResponse","field":[{"name":"sentence","number":1,"label":"LABEL_OPTIONAL","type":"TYPE_STRING","jsonName":"sentence"}]}],"service":[{"name":"ElizaService","method":[{"name":"Say","inputType":".connectrpc.eliza.v1.SayRequest","outputType":".connectrpc.eliza.v1.SayResponse","options":{"idempotencyLevel":"NO_SIDE_EFFECTS"}},{"name":"Converse","inputType":".connectrpc.eliza.v1.ConverseRequest","outputType":".connectrpc.eliza.v1.ConverseResponse","options":{},"clientStreaming":true,"serverStreaming":true},{"name":"Introduce","inputType":".connectrpc.eliza.v1.IntroduceRequest","outputType":".connectrpc.eliza.v1.IntroduceResponse","options":{},"serverStreaming":true}]}],"syntax":"proto3"}]},"version":"233fca715f49425581ec0a1b660be886"}'
                ),
              };
            },
          };
        }
      );
      const methods = await loadMethodsFromReflection({
        url: 'foo.com',
        metadata: [],
        reflectionApi: {
          enabled: true,
          apiKey: 'TEST_KEY',
          url: 'https://buf.build',
          module: 'buf.build/connectrpc/eliza',
        },
      });
      expect(methods).toStrictEqual(
        [
           {
            example: undefined,
            fullPath: '/connectrpc.eliza.v1.ElizaService/Say',
            type: 'unary',
          },
           {
            example: undefined,
            fullPath: '/connectrpc.eliza.v1.ElizaService/Converse',
            type: 'bidi',
          },
           {
            example: undefined,
            fullPath: '/connectrpc.eliza.v1.ElizaService/Introduce',
            type: 'server',
          },
        ]
      );
    });
  });
});
