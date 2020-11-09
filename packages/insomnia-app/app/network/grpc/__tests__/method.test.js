// @flow

import { canClientStream, getMethodType, GrpcMethodTypeEnum, GrpcMethodTypeName } from '../method';
import type { GrpcMethodType } from '../method';

describe('getMethodType', () => {
  it('should return unary', () => {
    expect(getMethodType({ requestStream: false, responseStream: false })).toBe(
      GrpcMethodTypeEnum.unary,
    );
  });

  it('should return server', () => {
    expect(getMethodType({ requestStream: false, responseStream: true })).toBe(
      GrpcMethodTypeEnum.server,
    );
  });

  it('should return client', () => {
    expect(getMethodType({ requestStream: true, responseStream: false })).toBe(
      GrpcMethodTypeEnum.client,
    );
  });

  it('should return bidi', () => {
    expect(getMethodType({ requestStream: true, responseStream: true })).toBe(
      GrpcMethodTypeEnum.bidi,
    );
  });
});

describe('GrpcMethodTypeName', () => {
  it.each([
    [GrpcMethodTypeEnum.unary, 'Unary'],
    [GrpcMethodTypeEnum.server, 'Server Streaming'],
    [GrpcMethodTypeEnum.client, 'Client Streaming'],
    [GrpcMethodTypeEnum.bidi, 'Bi-directional Streaming'],
  ])('should return expected result', (type: GrpcMethodType, expectedString: string) => {
    expect(GrpcMethodTypeName[type]).toBe(expectedString);
  });
});

describe('canClientStream', () => {
  it.each([
    GrpcMethodTypeEnum.unary,
    GrpcMethodTypeEnum.server,
  ])('should not support client streaming with %o', (type: GrpcMethodType) =>
    expect(canClientStream(type)).toBe(false),
  );

  it.each([
    GrpcMethodTypeEnum.client,
    GrpcMethodTypeEnum.bidi,
  ])('should support client streaming with %o', (type: GrpcMethodType) =>
    expect(canClientStream(type)).toBe(true),
  );
});
