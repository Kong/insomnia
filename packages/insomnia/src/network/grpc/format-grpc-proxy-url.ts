const formatGrpcProxyUrl = (url: string): {
	url: string | undefined;
	error: Error | null;
} => {
  if (url.startsWith('http:')) {
    return {
      url,
      error: null,
    };
  }
  if (url.includes('://')) {
    const { protocol } = new URL(url);
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
