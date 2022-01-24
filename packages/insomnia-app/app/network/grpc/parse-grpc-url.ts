const parseGrpcUrl = (
  grpcUrl?: string,
): {
  url: string;
  enableTls: boolean;
} => {

  if (!grpcUrl){
    return { url: '', enableTls: false };
  }
  const lowercaseUrl = grpcUrl.toLowerCase();
  const isGRPCURL = lowercaseUrl.startsWith('grpc:');
  const isGRPCSURL = lowercaseUrl.startsWith('grpcs:');
  if (!isGRPCURL && !isGRPCSURL){
    return { url: lowercaseUrl || '', enableTls: false };
  }

  return { url: new URL(lowercaseUrl).host, enableTls: isGRPCSURL };

};

export default parseGrpcUrl;
