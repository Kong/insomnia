export const parseGrpcUrl = (grpcUrl: string): { url: string; enableTls: boolean } => {
  if (!grpcUrl) {
    return { url: '', enableTls: false };
  }
  const lower = grpcUrl.toLowerCase();
  if (lower.startsWith('grpc://')) {
    return { url: lower.slice(7), enableTls: false };
  }
  if (lower.startsWith('grpcs://')) {
    return { url: lower.slice(8), enableTls: true };
  }
  return { url: lower, enableTls: false };
};
