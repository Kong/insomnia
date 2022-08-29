const isValidGrpcProxyUrl = (url: string): {
	error: Error | null;
} => {
  const { protocol } = new URL(url);
  // supported protocols: https://github.com/grpc/grpc-node/blob/master/packages/grpc-js/src/http_proxy.ts#L71
  if (protocol === 'http:') {
    return {
      error: new Error(`"${protocol}" scheme not supported in GRPC proxy URI`),
    }
  };
  return {
    error: null
  }
}

export default isValidGrpcProxyUrl;
