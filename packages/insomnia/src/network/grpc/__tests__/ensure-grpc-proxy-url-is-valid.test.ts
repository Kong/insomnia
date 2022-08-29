import { describe, expect, it } from '@jest/globals';

import ensureGrpcProxyUrlIsValid from '../ensure-grpc-proxy-url-is-valid';

describe('ensureGrpcProxyUrlIsValid', () => {
  it.each([
    ['https://some.proxy.com:8080', 'https:'],
    ['ws://some.proxy.com:8080', 'ws:'],
  ])('should return error', (input, protocol) => {
    expect(ensureGrpcProxyUrlIsValid(input)).toStrictEqual({
      error: new Error(`"${protocol}" scheme not supported in GRPC proxy URI`),
    });
  });

  it.each([
    ['http://some.proxy.com:8080'],
  ])('should not return error', input => {
    expect(ensureGrpcProxyUrlIsValid(input)).toStrictEqual({
      error: null,
    });
  });
});
