import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as grpcReflection from 'grpc-reflection-js';
import protobuf from 'protobufjs';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { loadMethodsFromReflection } from '../grpc';

jest.mock('grpc-reflection-js');

describe('loadMethodsFromReflection', () => {
  beforeEach(globalBeforeEach);

  describe('one service reflection', () => {
    beforeEach(() => {
      globalBeforeEach();
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as jest.Mock).mockImplementation(() => ({
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
      const methods = await loadMethodsFromReflection({ url: 'foo.com', metadata: [] });
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
      globalBeforeEach();
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as jest.Mock).mockImplementation(() => ({
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
      const methods = await loadMethodsFromReflection({ url: 'foo.com', metadata: [] });
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
      globalBeforeEach();
      // we want to test that the values that are passed to axios are returned in the config key
      (grpcReflection.Client as unknown as jest.Mock).mockImplementation(() => ({
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
      const methods = await loadMethodsFromReflection({ url: 'foo-bar.com', metadata: [] });
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

});
