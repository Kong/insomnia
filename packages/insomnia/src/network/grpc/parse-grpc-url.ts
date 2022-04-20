import { parse as urlParse } from 'url';

const parseGrpcUrl = (
  grpcUrl?: string,
): {
  url: string;
  enableTls: boolean;
} => {
  const { protocol, host, href } = urlParse(grpcUrl?.toLowerCase() || '');

  switch (protocol) {
    case 'grpcs:':
      return {
        // @ts-expect-error -- TSCONVERSION host can be undefined
        url: host,
        enableTls: true,
      };

    case 'grpc:':
      return {
        // @ts-expect-error -- TSCONVERSION host can be undefined
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
