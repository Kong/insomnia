const GRPC_CONNECTION_ERROR_STRINGS = {
  SERVER_SELF_SIGNED: 'self signed certificate in certificate chain',
  CLIENT_CERT_REQUIRED: 'CERTIFICATE_REQUIRED',
  SERVER_CANCELED: 'CANCELLED',
  TLS_NOT_SUPPORTED: 'WRONG_VERSION_NUMBER',
  BAD_LOCAL_ROOT_CERT: 'unable to get local issuer certificate',
  UNIMPLEMENTED: 'UNIMPLEMENTED',
  // this next one will break if we rename the call made from the pane
  CANNOT_REFLECT: "'grpc.loadMethodsFromReflection': Error: 12",
};

export function isGrpcConnectionError(error: Error) {
  return (error && error.message && (
    Object.values(GRPC_CONNECTION_ERROR_STRINGS).find(str => error.message.includes(str)) !== null
  ));
}

export function getGrpcConnectionErrorDetails(error: Error) {
  let title: string | undefined = undefined;
  let message: string | undefined = undefined;
  if (!isGrpcConnectionError(error)) {
    return { title, message };
  }

  if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.SERVER_SELF_SIGNED)) {
    title = 'Server Certificate Cannot Be Validated';
    message = 'The server is using a certificate that cannot be validated.\nAdd the server\'s root certificate to this collection or disable SSL validation for requests in Preferences.';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.CLIENT_CERT_REQUIRED)) {
    title = 'Client Certificate Required';
    message = 'The server requires a client certificate to establish a connection.';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.SERVER_CANCELED)) {
    title = 'Server Cancelled Request';
    message = 'The request was cancelled by the server.\nIf the server requires a TLS connection, ensure the request URL is prefixed with "grpcs://".';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.TLS_NOT_SUPPORTED)) {
    title = 'TLS Not Supported';
    message = 'The server does not support TLS connections.\nRemove the "grpcs://" prefix from the request URL to make an insecure request.';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.BAD_LOCAL_ROOT_CERT)) {
    title = 'Local Root Certificate Error';
    message = 'The local root certificate enabled for the host is not valid.\nEither disable the root certificate, or update it with a valid one.';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.CANNOT_REFLECT)) {
    title = 'Reflection Not Supported';
    message = 'The server has indicated that it does not support reflection. You may need to manually enable it server-side.';
  } else if (error.message.includes(GRPC_CONNECTION_ERROR_STRINGS.UNIMPLEMENTED)) {
    title = 'Unimplemented Method';
    message = 'The server does not support the requested method. Is the .proto file correct?';
  }

  return {
    title,
    message,
  };
}
