import { describe, expect, it } from '@jest/globals';

import { getMethodType } from '../../../common/grpc-paths';
import { GrpcMethodType } from '../../../main/ipc/grpc';
import { canClientStream } from '../../../ui/components/panes/grpc-request-pane';

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
