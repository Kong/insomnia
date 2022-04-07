import parseGrpcUrl from '../parse-grpc-url';

describe('parseGrpcUrl', () => {
  it.each([
    ['grpcb.in:9000', 'grpcb.in:9000'],
    ['GRPCB.IN:9000', 'grpcb.in:9000'],
    ['custom.co', 'custom.co'],
  ])('should not enable tls with no protocol: %s', (input, expected) => {
    expect(parseGrpcUrl(input)).toStrictEqual({
      url: expected,
      enableTls: false,
    });
  });

  it.each([
    ['grpcs://grpcb.in:9000', 'grpcb.in:9000'],
    ['GRPCS://GRPCB.IN:9000', 'grpcb.in:9000'],
    ['grpcs://custom.co', 'custom.co'],
  ])('should enable tls with grpcs:// protocol: %s', (input, expected) => {
    expect(parseGrpcUrl(input)).toStrictEqual({
      url: expected,
      enableTls: true,
    });
  });

  it.each([
    ['grpc://grpcb.in:9000', 'grpcb.in:9000'],
    ['GRPC://GRPCB.IN:9000', 'grpcb.in:9000'],
    ['grpc://custom.co', 'custom.co'],
  ])('should not enable tls with no grpc:// protocol: %s', (input, expected) => {
    expect(parseGrpcUrl(input)).toStrictEqual({
      url: expected,
      enableTls: false,
    });
  });

  it.each([null, undefined, ''])('can handle falsey urls', input => {
    expect(parseGrpcUrl(input)).toStrictEqual({
      url: '',
      enableTls: false,
    });
  });
});
