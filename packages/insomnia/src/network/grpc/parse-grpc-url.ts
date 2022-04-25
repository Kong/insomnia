const parseGrpcUrl = (
  grpcUrl?: string,
): {
  url: string;
  enableTls: boolean;
} => {
  const { protocol, host, href } = new URL(grpcUrl?.toLowerCase() || '');

  switch (protocol) {
    case 'grpcs:':
      return {
        url: host,
        enableTls: true,
      };

    case 'grpc:':
      return {
        url: host,
        enableTls: false,
      };

    default:
      return {
        url: href,
        enableTls: false,
      };
  }
};

export default parseGrpcUrl;
