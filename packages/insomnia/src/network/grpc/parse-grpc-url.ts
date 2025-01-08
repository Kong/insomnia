export const parseGrpcUrl = (grpcUrl: string): { url: string; enableTls: boolean; path: string } => {
  if (!grpcUrl) {
    return { url: '', enableTls: false, path: '' };
  }
  const url = new URL(grpcUrl);
  const result = {
    url: url.host,
    enableTls: false,
    path: url.pathname,
  };
  if (url.protocol === 'grpcs:') {
    result.enableTls = true;
  }
  if (result.path === '/') {
    result.path = '';
  }
  return result;
};
