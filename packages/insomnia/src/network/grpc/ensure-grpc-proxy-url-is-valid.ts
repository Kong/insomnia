const ensureGrpcProxyUrlIsValid = (url: string): {
	error: Error | null;
} => {
  // url should have supported protocol

  const { protocol } = new URL(url);
  console.log({ protocol, url });
  if (!isSupportedProtocol(protocol)) {
    return {
      error: new Error(`"${protocol}" scheme not supported in GRPC proxy URI`),
    };
  }

  return {
    error: null,
  };
};

// supported protocols: https://github.com/grpc/grpc-node/blob/master/packages/grpc-js/src/http_proxy.ts#L71
const isSupportedProtocol = (protocol: string): boolean => {
  return protocol === 'http:';
};

export default ensureGrpcProxyUrlIsValid;
