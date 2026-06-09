const throwError = () => {
  throw new Error('GrpcRuntime not available in node');
};

export const start = throwError;
export const sendMessage = throwError;
export const commit = throwError;
export const cancel = throwError;
export const loadMethods = throwError;
export const loadMethodsFromReflection = throwError;
export const closeAll = throwError;
export const writeProtoFile = throwError;
export const validateProtoFile = throwError;
