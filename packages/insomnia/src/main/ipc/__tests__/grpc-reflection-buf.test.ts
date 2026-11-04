import { type DescMessage, type DescMethodUnary, fromJson, type JsonObject, type MessageInitShape } from '@bufbuild/protobuf';
import { Code, ConnectError, type UnaryResponse } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { version } from '../../../../package.json';
import { loadMethodsFromReflection } from '../grpc';

vi.mock('@connectrpc/connect-node');
vi.mock('../../../network/grpc/write-proto-file.node');

const reflectionApi = {
  enabled: true,
  apiKey: 'TEST_KEY',
  url: 'https://buf.build',
  module: 'buf.build/acme/greeter',
};

const fileDescriptorSetJson: JsonObject = {
  file: [
    {
      name: 'acme/greeter/v1/greeter.proto',
      package: 'acme.greeter.v1',
      syntax: 'proto3',
      messageType: [
        {
          name: 'Msg',
          field: [{ name: 'text', number: 1, label: 'LABEL_OPTIONAL', type: 'TYPE_STRING', jsonName: 'text' }],
        },
      ],
      service: [
        {
          name: 'GreeterService',
          method: [
            { name: 'Unary', inputType: '.acme.greeter.v1.Msg', outputType: '.acme.greeter.v1.Msg' },
            {
              name: 'ClientStream',
              inputType: '.acme.greeter.v1.Msg',
              outputType: '.acme.greeter.v1.Msg',
              clientStreaming: true,
            },
            {
              name: 'ServerStream',
              inputType: '.acme.greeter.v1.Msg',
              outputType: '.acme.greeter.v1.Msg',
              serverStreaming: true,
            },
            {
              name: 'BidiStream',
              inputType: '.acme.greeter.v1.Msg',
              outputType: '.acme.greeter.v1.Msg',
              clientStreaming: true,
              serverStreaming: true,
            },
          ],
        },
      ],
    },
  ],
};

// Installs a fake Connect transport whose unary() is the given mock.
const useTransport = (unary: ReturnType<typeof vi.fn>) => {
  vi.mocked(createConnectTransport).mockReturnValue({ unary } as unknown as ReturnType<typeof createConnectTransport>);
};

const loadBuf = (options: { apiKey?: string; disableUserAgentHeader?: boolean } = {}) =>
  loadMethodsFromReflection({
    url: 'foo.com',
    metadata: [],
    rejectUnauthorized: true,
    disableUserAgentHeader: options.disableUserAgentHeader,
    reflectionApi: { ...reflectionApi, apiKey: options.apiKey ?? reflectionApi.apiKey },
  });

const headersOf = (unary: ReturnType<typeof vi.fn>) => new Headers(unary.mock.calls[0][3] as HeadersInit);

describe('loadMethodsFromReflection (buf reflection api)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error mapping', () => {
    it('maps Unauthenticated to an invalid api key error', async () => {
      useTransport(vi.fn().mockRejectedValue(new ConnectError('denied', Code.Unauthenticated)));

      await expect(loadBuf()).rejects.toThrow('Invalid reflection server api key');
    });

    it('maps NotFound to a module access error', async () => {
      useTransport(vi.fn().mockRejectedValue(new ConnectError('missing', Code.NotFound)));

      await expect(loadBuf()).rejects.toThrow(
        "The reflection server api key doesn't have access to the module or the module does not exists",
      );
    });

    it('rethrows other Connect errors unchanged', async () => {
      const error = new ConnectError('boom', Code.Internal);
      useTransport(vi.fn().mockRejectedValue(error));

      await expect(loadBuf()).rejects.toBe(error);
    });

    it('rethrows non-Connect errors unchanged', async () => {
      const error = new Error('network down');
      useTransport(vi.fn().mockRejectedValue(error));

      await expect(loadBuf()).rejects.toBe(error);
    });
  });

  describe('request headers', () => {
    it('sends the Insomnia User-Agent and Bearer auth when enabled', async () => {
      const unary = vi.fn().mockRejectedValue(new ConnectError('stop', Code.Internal));
      useTransport(unary);

      await expect(loadBuf()).rejects.toBeDefined();

      expect(headersOf(unary).get('User-Agent')).toBe(`insomnia/${version}`);
      expect(headersOf(unary).get('Authorization')).toBe('Bearer TEST_KEY');
    });

    it('omits the User-Agent header when disabled', async () => {
      const unary = vi.fn().mockRejectedValue(new ConnectError('stop', Code.Internal));
      useTransport(unary);

      await expect(loadBuf({ disableUserAgentHeader: true })).rejects.toBeDefined();

      expect(headersOf(unary).has('User-Agent')).toBe(false);
      expect(headersOf(unary).get('Authorization')).toBe('Bearer TEST_KEY');
    });

    it('omits the Authorization header when no api key is set', async () => {
      const unary = vi.fn().mockRejectedValue(new ConnectError('stop', Code.Internal));
      useTransport(unary);

      await expect(loadBuf({ apiKey: '' })).rejects.toBeDefined();

      expect(headersOf(unary).has('Authorization')).toBe(false);
    });
  });

  describe('response handling', () => {
    it('returns no methods when the response has no file descriptor set', async () => {
      useTransport(
        vi.fn(
          async (method: DescMethodUnary): Promise<UnaryResponse> =>
            ({ message: fromJson(method.output, {}) }) as unknown as UnaryResponse,
        ),
      );

      await expect(loadBuf()).resolves.toStrictEqual([]);
    });

    it('maps unary, client, server and bidi methods from the file descriptor set', async () => {
      useTransport(
        vi.fn(
          async (
            method: DescMethodUnary,
            _signal: AbortSignal | undefined,
            _timeoutMs: number | undefined,
            _header: HeadersInit | undefined,
            _input: MessageInitShape<DescMessage>,
          ): Promise<UnaryResponse> =>
            ({
              message: fromJson(method.output, { fileDescriptorSet: fileDescriptorSetJson }),
            }) as unknown as UnaryResponse,
        ),
      );

      const methods = await loadBuf();

      expect(methods.map(({ fullPath, type }) => ({ fullPath, type }))).toStrictEqual([
        { fullPath: '/acme.greeter.v1.GreeterService/Unary', type: 'unary' },
        { fullPath: '/acme.greeter.v1.GreeterService/ClientStream', type: 'client' },
        { fullPath: '/acme.greeter.v1.GreeterService/ServerStream', type: 'server' },
        { fullPath: '/acme.greeter.v1.GreeterService/BidiStream', type: 'bidi' },
      ]);
    });
  });
});
