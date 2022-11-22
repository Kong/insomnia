import { describe, expect, it } from '@jest/globals';

import type { GrpcMethodType } from '../method';
import { canClientStream, getMethodType, GrpcMethodTypeName } from '../method';

describe('getMethodType', () => {
  it('should return unary', () => {
    expect(
      getMethodType({
        requestStream: false,
        responseStream: false,
      }),
    ).toBe('unary');
  });

  it('should return server', () => {
    expect(
      getMethodType({
        requestStream: false,
        responseStream: true,
      }),
    ).toBe('server');
  });

  it('should return client', () => {
    expect(
      getMethodType({
        requestStream: true,
        responseStream: false,
      }),
    ).toBe('client');
  });

  it('should return bidi', () => {
    expect(
      getMethodType({
        requestStream: true,
        responseStream: true,
      }),
    ).toBe('bidi');
  });
});

describe('GrpcMethodTypeName', () => {
  it.each([
    ['unary', 'Unary'],
    ['server', 'Server Streaming'],
    ['client', 'Client Streaming'],
    ['bidi', 'Bi-directional Streaming'],
  ])('should return expected result', (type: GrpcMethodType, expectedString: string) => {
    expect(GrpcMethodTypeName[type]).toBe(expectedString);
  });
});

describe('canClientStream', () => {
  it.each([
    'unary',
    'server',
  ])('should not support client streaming with %o', (type: GrpcMethodType) =>
    expect(canClientStream(type)).toBe(false),
  );

  it.each([
    'client',
    'bidi',
  ])('should support client streaming with %o', (type: GrpcMethodType) =>
    expect(canClientStream(type)).toBe(true),
  );
});
