export const parseGrpcUrl = (grpcUrl: string): { url: string; enableTls: boolean; path: string } => {
  if (!grpcUrl) {
    return { url: '', enableTls: false, path: '' };
  }
  const lcUrl = grpcUrl.toLowerCase();
  let url = {
    protocol: 'grpc:',
    hostname: lcUrl,
    pathname: '',
    port: undefined,
  } as unknown as URL;
  if (lcUrl.includes('://')) {
    try {
      url = new URL(grpcUrl.toLowerCase());
    } catch (e) { }
  }
  const result = {
    url: `${url.hostname}` + (url.port ? `:${url.port}` : ''),
    enableTls: false,
    path: url.pathname,
  };
  if (url.protocol.toLowerCase() === 'grpcs:') {
    result.enableTls = true;
  }
  if (result.path === '/') {
    result.path = '';
  }
  return result;
};
