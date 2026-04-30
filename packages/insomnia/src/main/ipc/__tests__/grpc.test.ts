import type { AnyMessage, MethodInfo, PartialMessage } from '@bufbuild/protobuf';
import { create } from '@bufbuild/protobuf';
import {
  DescriptorProtoSchema,
  FieldDescriptorProtoSchema,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MethodDescriptorProtoSchema,
  ServiceDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt';
import type { UnaryResponse } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import * as grpcReflection from 'grpc-reflection-js';
import protobuf from 'protobufjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { services } from '~/insomnia-data';

import { loadMethodsFromReflection, writeProtoFileById } from '../grpc';

vi.mock('grpc-reflection-js');
vi.mock('@connectrpc/connect-node');
vi.mock('../../../network/grpc/write-proto-file');
vi.mock('@grpc/proto-loader', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, load: vi.fn().mockResolvedValue({}) };
});

describe('writeProtoFileById', () => {
  it('resolves proto file from services and delegates to writeProtoFile', async () => {
    const { writeProtoFile } = await import('../../../network/grpc/write-proto-file');
    const { load } = await import('@grpc/proto-loader');
    const w = await services.workspace.create();
    const pf = await services.protoFile.create({ parentId: w._id, protoText: 'text' });
    const expected = { filePath: 'foo.proto', dirs: ['/tmp/insomnia-grpc'] };
    vi.mocked(writeProtoFile).mockResolvedValue(expected);

    const result = await writeProtoFileById(pf._id);

    expect(writeProtoFile).toHaveBeenCalledWith(expect.objectContaining({ _id: pf._id }));
    expect(load).toHaveBeenCalledWith('foo.proto', expect.objectContaining({ includeDirs: ['/tmp/insomnia-grpc'] }));
    expect(result).toEqual(expected);
  });

  it('throws when the proto file is not found', async () => {
    await expect(writeProtoFileById('nonexistent-id')).rejects.toThrow('Proto file nonexistent-id not found');
  });
});

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
      expect(methods).toStrictEqual([
        {
          type: 'unary',
          fullPath: '/FooService/Foo',
          example: {
            foo: 'Hello',
          },
        },
      ]);
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
      expect(methods).toStrictEqual([
        {
          type: 'unary',
          fullPath: '/FooService/format',
          example: {
            foo: 'Hello',
          },
        },
      ]);
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
      expect(methods).toStrictEqual([
        {
          type: 'unary',
          fullPath: '/FooService/Foo',
          example: {
            foo: 'Hello',
          },
        },
        {
          type: 'unary',
          fullPath: '/BarService/Bar',
          example: {
            bar: 'Hello',
          },
        },
      ]);
    });
  });

  describe('buf reflection api', () => {
    it('loads module', async () => {
      (createConnectTransport as unknown as vi.Mock).mockImplementation(options => {
        expect(options.baseUrl).toStrictEqual('https://buf.build');
        return {
          async unary(
            method: MethodInfo,
            signal: AbortSignal | undefined,
            timeoutMs: number | undefined,
            header: HeadersInit | undefined,
            input: PartialMessage<AnyMessage>,
          ): Promise<UnaryResponse> {
            expect(new Headers(header).get('Authorization')).toStrictEqual('Bearer TEST_KEY');
            expect(input).toStrictEqual({ module: 'buf.build/connectrpc/eliza' });
            // Create a FileDescriptorSet-like response with the parsed proto file
            const fileDescriptorSet = create(FileDescriptorSetSchema, {
              file: [
                create(FileDescriptorProtoSchema, {
                  name: 'connectrpc/eliza/v1/eliza.proto',
                  package: 'connectrpc.eliza.v1',
                  messageType: [
                    create(DescriptorProtoSchema, {
                      name: 'SayRequest',
                      field: [create(FieldDescriptorProtoSchema, { name: 'sentence', number: 1, label: 1, type: 9, jsonName: 'sentence' })],
                    }),
                    create(DescriptorProtoSchema, {
                      name: 'SayResponse',
                      field: [create(FieldDescriptorProtoSchema, { name: 'sentence', number: 1, label: 1, type: 9, jsonName: 'sentence' })],
                    }),
                    create(DescriptorProtoSchema, {
                      name: 'ConverseRequest',
                      field: [create(FieldDescriptorProtoSchema, { name: 'sentence', number: 1, label: 1, type: 9, jsonName: 'sentence' })],
                    }),
                    create(DescriptorProtoSchema, {
                      name: 'ConverseResponse',
                      field: [create(FieldDescriptorProtoSchema, { name: 'sentence', number: 1, label: 1, type: 9, jsonName: 'sentence' })],
                    }),
                    create(DescriptorProtoSchema, {
                      name: 'IntroduceRequest',
                      field: [create(FieldDescriptorProtoSchema, { name: 'name', number: 1, label: 1, type: 9, jsonName: 'name' })],
                    }),
                    create(DescriptorProtoSchema, {
                      name: 'IntroduceResponse',
                      field: [create(FieldDescriptorProtoSchema, { name: 'sentence', number: 1, label: 1, type: 9, jsonName: 'sentence' })],
                    }),
                  ],
                  service: [
                    create(ServiceDescriptorProtoSchema, {
                      name: 'ElizaService',
                      method: [
                        create(MethodDescriptorProtoSchema, {
                          name: 'Say',
                          inputType: '.connectrpc.eliza.v1.SayRequest',
                          outputType: '.connectrpc.eliza.v1.SayResponse',
                        }),
                        create(MethodDescriptorProtoSchema, {
                          name: 'Converse',
                          inputType: '.connectrpc.eliza.v1.ConverseRequest',
                          outputType: '.connectrpc.eliza.v1.ConverseResponse',
                          clientStreaming: true,
                          serverStreaming: true,
                        }),
                        create(MethodDescriptorProtoSchema, {
                          name: 'Introduce',
                          inputType: '.connectrpc.eliza.v1.IntroduceRequest',
                          outputType: '.connectrpc.eliza.v1.IntroduceResponse',
                          serverStreaming: true,
                        }),
                      ],
                    }),
                  ],
                  syntax: 'proto3',
                }),
              ],
            });
            return {
              service: {} as any,
              method: method,
              header: new Headers(),
              trailer: new Headers(),
              stream: false,
              message: {
                fileDescriptorSet,
              } as any,
            };
          },
        };
      });
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
      expect(methods).toStrictEqual([
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
      ]);
    });
  });
});
