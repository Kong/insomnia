const formatGrpcProxyUrl = (url: string): {
	url: string | undefined;
	error: Error | null;
} => {
  const { protocol } = new URL(url);
  if (protocol === 'http:') {
    return {
      url,
      error: null,
    };
  }
  if (protocol !== 'http:') {
    // const { protocol } = new URL(url);
    return {
      url: undefined,
      error: new Error(`"${protocol}" scheme not supported in GRPC proxy URI`),
    };
  }
  return {
    url: `http://${url}`,
    error: null,
  };
};

export default formatGrpcProxyUrl;
