import { parse as urlParse } from 'url';

export const parseGrpcUrl = (grpcUrl: string) => {
  const { protocol, host, href } = urlParse(grpcUrl?.toLowerCase() || '');
  if (protocol === 'grpcs:') {
    return { url: host, enableTls: true };
  }
  if (protocol === 'grpc:') {
    return { url: host, enableTls: false };
  }
  return { url: href, enableTls: false };
};
