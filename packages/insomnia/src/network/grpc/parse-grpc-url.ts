export const parseGrpcUrl = (grpcUrl: string): { url: string; enableTls: boolean; path: string } => {
  if (!grpcUrl) {
    return { url: '', enableTls: false, path: '' };
  }
  const url = new URL((grpcUrl.includes('://') ? '' : 'grpc://') + grpcUrl.toLowerCase());
  return {
    url: url.host,
    enableTls: url.protocol === 'grpcs:',
    // remove trailing slashes from pathname; the full request
    // path is a concatenation of this parsed path + method path
    path: url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname,
  };
};
